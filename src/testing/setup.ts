// Ensure chalk doesn't output ANSI color codes during tests
// This must be set before chalk is imported
process.env["NO_COLOR"] = "1";
process.env["FORCE_COLOR"] = "0";
