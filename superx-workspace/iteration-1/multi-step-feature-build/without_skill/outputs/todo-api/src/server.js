require("dotenv").config();
const app = require("./app");
const { getDb } = require("./db/database");

const PORT = process.env.PORT || 3000;

// Initialize database on startup
getDb();

app.listen(PORT, () => {
  console.log(`Todo API server running on port ${PORT}`);
});
