/*
 * edit-tracker — log and verify all Write/Edit tool calls in a session.
 *
 * Modes:
 *   log <tool> <filepath>   — called from PostToolUse hook. Appends entry.
 *   list                    — dump all tracked edits as JSON lines.
 *   summary                 — print human-readable summary (file count, paths).
 *   clear                   — wipe session ledger.
 *
 * State: line-based ledger at $TMPDIR/heimdall-edits/$SESSION_ID.log
 * Each line: timestamp_ms|tool|filepath
 *
 * Cold start: ~1ms (static binary, no interpreter).
 *
 * Build: clang -O2 -Wall -Wextra -o bin/edit-tracker bin/edit-tracker.c
 */

#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

static long long now_ms(void) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (long long)tv.tv_sec * 1000LL + (long long)(tv.tv_usec / 1000);
}

static int mkdir_p(const char *path) {
    char tmp[1024];
    snprintf(tmp, sizeof(tmp), "%s", path);
    size_t len = strlen(tmp);
    if (len == 0) return 0;
    if (tmp[len - 1] == '/') tmp[len - 1] = '\0';
    for (char *p = tmp + 1; *p; p++) {
        if (*p == '/') {
            *p = '\0';
            if (mkdir(tmp, 0755) != 0 && errno != EEXIST) return -1;
            *p = '/';
        }
    }
    if (mkdir(tmp, 0755) != 0 && errno != EEXIST) return -1;
    return 0;
}

static void ledger_dir(char *out, size_t cap) {
    const char *tmpdir = getenv("TMPDIR");
    if (!tmpdir || !*tmpdir) tmpdir = "/tmp";
    size_t tlen = strlen(tmpdir);
    int needs_slash = (tlen > 0 && tmpdir[tlen - 1] != '/');
    snprintf(out, cap, "%s%sheimdall-edits", tmpdir, needs_slash ? "/" : "");
}

static void ledger_path(char *out, size_t cap) {
    char dir[512];
    ledger_dir(dir, sizeof(dir));
    const char *sid = getenv("CLAUDE_SESSION_ID");
    if (!sid || !*sid) sid = getenv("SESSION_ID");
    if (!sid || !*sid) sid = "default";
    snprintf(out, cap, "%s/%s.log", dir, sid);
}

static void lock_path(char *out, size_t cap) {
    char dir[512];
    ledger_dir(dir, sizeof(dir));
    const char *sid = getenv("CLAUDE_SESSION_ID");
    if (!sid || !*sid) sid = getenv("SESSION_ID");
    if (!sid || !*sid) sid = "default";
    snprintf(out, cap, "%s/%s.lock", dir, sid);
}

static int do_log(const char *tool, const char *filepath) {
    char dir[512], lp[1024], lk[1024];
    ledger_dir(dir, sizeof(dir));
    if (mkdir_p(dir) != 0) return 1;
    ledger_path(lp, sizeof(lp));
    lock_path(lk, sizeof(lk));

    int lock_fd = open(lk, O_RDWR | O_CREAT, 0644);
    if (lock_fd < 0) return 1;
    if (flock(lock_fd, LOCK_EX) != 0) { close(lock_fd); return 1; }

    FILE *f = fopen(lp, "a");
    if (f) {
        fprintf(f, "%lld|%s|%s\n", now_ms(), tool, filepath);
        fclose(f);
    }

    flock(lock_fd, LOCK_UN);
    close(lock_fd);
    return 0;
}

static int do_list(void) {
    char lp[1024];
    ledger_path(lp, sizeof(lp));
    FILE *f = fopen(lp, "r");
    if (!f) { printf("[]\n"); return 0; }

    char line[4096];
    int first = 1;
    printf("[");
    while (fgets(line, sizeof(line), f)) {
        size_t len = strlen(line);
        if (len > 0 && line[len - 1] == '\n') line[len - 1] = '\0';

        char *sep1 = strchr(line, '|');
        if (!sep1) continue;
        *sep1 = '\0';
        char *sep2 = strchr(sep1 + 1, '|');
        if (!sep2) continue;
        *sep2 = '\0';

        char *ts = line;
        char *tool = sep1 + 1;
        char *path = sep2 + 1;

        if (!first) printf(",");
        first = 0;

        /* JSON-escape the path */
        printf("{\"ts\":%s,\"tool\":\"%s\",\"path\":\"", ts, tool);
        for (char *p = path; *p; p++) {
            if (*p == '"') printf("\\\"");
            else if (*p == '\\') printf("\\\\");
            else putchar(*p);
        }
        printf("\"}");
    }
    printf("]\n");
    fclose(f);
    return 0;
}

static int do_summary(void) {
    char lp[1024];
    ledger_path(lp, sizeof(lp));
    FILE *f = fopen(lp, "r");
    if (!f) {
        printf("No edits tracked this session.\n");
        return 0;
    }

    /* Collect unique paths and counts */
    char paths[512][4096];
    int counts[512];
    char tools[512][16];
    int n = 0;
    char line[4096];

    while (fgets(line, sizeof(line), f)) {
        size_t len = strlen(line);
        if (len > 0 && line[len - 1] == '\n') line[len - 1] = '\0';

        char *sep1 = strchr(line, '|');
        if (!sep1) continue;
        char *sep2 = strchr(sep1 + 1, '|');
        if (!sep2) continue;

        char *tool = sep1 + 1;
        *sep2 = '\0';
        char *path = sep2 + 1;

        /* Find existing or add */
        int found = -1;
        for (int i = 0; i < n; i++) {
            if (strcmp(paths[i], path) == 0) { found = i; break; }
        }
        if (found >= 0) {
            counts[found]++;
        } else if (n < 512) {
            strncpy(paths[n], path, sizeof(paths[n]) - 1);
            paths[n][sizeof(paths[n]) - 1] = '\0';
            strncpy(tools[n], tool, sizeof(tools[n]) - 1);
            tools[n][sizeof(tools[n]) - 1] = '\0';
            counts[n] = 1;
            n++;
        }
    }
    fclose(f);

    int total_ops = 0;
    for (int i = 0; i < n; i++) total_ops += counts[i];

    printf("[heimdall] edit tracker: %d files, %d operations\n", n, total_ops);
    for (int i = 0; i < n; i++) {
        /* Check if file exists */
        struct stat st;
        const char *status = (stat(paths[i], &st) == 0) ? "ok" : "MISSING";
        printf("  %s (%dx) [%s]\n", paths[i], counts[i], status);
    }
    return 0;
}

static int do_clear(void) {
    char lp[1024], lk[1024];
    ledger_path(lp, sizeof(lp));
    lock_path(lk, sizeof(lk));
    unlink(lp);
    unlink(lk);
    printf("Edit ledger cleared.\n");
    return 0;
}

static int do_paths(void) {
    char lp[1024];
    ledger_path(lp, sizeof(lp));
    FILE *f = fopen(lp, "r");
    if (!f) return 0;

    char seen[512][4096];
    int n = 0;
    char line[4096];

    while (fgets(line, sizeof(line), f)) {
        size_t len = strlen(line);
        if (len > 0 && line[len - 1] == '\n') line[len - 1] = '\0';

        char *sep1 = strchr(line, '|');
        if (!sep1) continue;
        char *sep2 = strchr(sep1 + 1, '|');
        if (!sep2) continue;
        char *path = sep2 + 1;

        int found = 0;
        for (int i = 0; i < n; i++) {
            if (strcmp(seen[i], path) == 0) { found = 1; break; }
        }
        if (!found && n < 512) {
            strncpy(seen[n], path, sizeof(seen[n]) - 1);
            seen[n][sizeof(seen[n]) - 1] = '\0';
            printf("%s\n", path);
            n++;
        }
    }
    fclose(f);
    return 0;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: edit-tracker log <tool> <path> | list | summary | paths | clear\n");
        return 1;
    }
    if (strcmp(argv[1], "log") == 0) {
        if (argc < 4) {
            fprintf(stderr, "usage: edit-tracker log <tool> <filepath>\n");
            return 1;
        }
        return do_log(argv[2], argv[3]);
    }
    if (strcmp(argv[1], "list") == 0) return do_list();
    if (strcmp(argv[1], "summary") == 0) return do_summary();
    if (strcmp(argv[1], "paths") == 0) return do_paths();
    if (strcmp(argv[1], "clear") == 0) return do_clear();

    fprintf(stderr, "usage: edit-tracker log <tool> <path> | list | summary | paths | clear\n");
    return 1;
}
