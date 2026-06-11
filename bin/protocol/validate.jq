# validate.jq — typed-message validator for the Token-Frugal Protocol v2.
#
# jq has no built-in JSON-Schema engine and we cannot assume ajv/python are
# present, so this program enforces EXACTLY the constraints in
# bin/protocol/message-schema.json (the published contract). Keep the two in
# lockstep: a change to the schema's required/enum sets must change this file.
#
# Input: one message object on stdin.
# Output: {"valid":bool,"errors":[string]} — always emitted (the bin reads it).
# Contract: a message is valid iff `errors` is empty.

def is_nonempty_string: type == "string" and (length > 0);

def base_errors:
  [ if has("type") then empty else "missing required field: type" end
  , if has("from") then empty else "missing required field: from" end
  , if has("msg_id") then empty else "missing required field: msg_id" end
  , if (.type // null) as $t
      | ($t == null) or (["task_claim","task_result","gate_report","escalation","question","checkpoint"] | index($t) != null)
    then empty else "type not in enum: \(.type)" end
  , if (has("from") | not) or (.from | is_nonempty_string) then empty else "from must be a non-empty string" end
  , if (has("msg_id") | not) or (.msg_id | is_nonempty_string) then empty else "msg_id must be a non-empty string" end
  ];

def require(field): if has(field) then empty else "\(.type): missing required field: \(field)" end;
def enum(field; allowed):
  . as $m
  | if ($m | has(field) | not) then empty
    elif (allowed | index($m[field]) != null) then empty
    else "\($m.type): \(field) not in enum \(allowed): \($m[field])" end;

def type_errors:
  (.type // "") as $t
  | if $t == "task_claim" then [ require("task") ]
    elif $t == "task_result" then [ require("task"), require("status"), enum("status"; ["pass","fail","partial"]) ]
    elif $t == "gate_report" then [ require("gate_id"), require("status"), enum("status"; ["pass","fail"]) ]
    elif $t == "escalation" then [ require("reason"), require("severity"), enum("severity"; ["blocker","warning","info"]) ]
    elif $t == "question" then [ require("question") ]
    elif $t == "checkpoint" then [ require("wave"), require("state"), enum("state"; ["started","in_progress","complete","blocked"]) ]
    else [] end;

( (base_errors + type_errors) | map(select(. != null)) ) as $errs
| { valid: ($errs | length == 0), errors: $errs }
