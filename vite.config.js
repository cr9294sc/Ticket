import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
function localDevApiPlugin() {
    return {
        name: "local-dev-api-plugin",
        configureServer: function (server) {
            // 1. Check if running in local dev mode
            server.middlewares.use(function (req, res, next) {
                if (req.url === "/api/dev-status") {
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ isDev: true }));
                    return;
                }
                // 2. Load raw CSV data
                if (req.url === "/api/load-csv" && req.method === "GET") {
                    var csvPath = path.resolve(__dirname, "data/my_trips.csv");
                    try {
                        var content = fs.existsSync(csvPath)
                            ? fs.readFileSync(csvPath, "utf-8")
                            : "";
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ success: true, content: content }));
                    }
                    catch (err) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                    return;
                }
                // 3. Save CSV and execute python preprocess
                if (req.url === "/api/save-csv" && req.method === "POST") {
                    var body_1 = "";
                    req.on("data", function (chunk) {
                        body_1 += chunk;
                    });
                    req.on("end", function () {
                        try {
                            var data = JSON.parse(body_1);
                            var csvContent = data.content;
                            var csvPath = path.resolve(__dirname, "data/my_trips.csv");
                            fs.writeFileSync(csvPath, csvContent, "utf-8");
                            // Run preprocessing script
                            exec("python3 scripts/preprocess.py", { cwd: __dirname }, function (error, stdout, stderr) {
                                if (error) {
                                    res.statusCode = 500;
                                    res.setHeader("Content-Type", "application/json");
                                    res.end(JSON.stringify({
                                        success: false,
                                        error: stderr || error.message,
                                        stdout: stdout,
                                    }));
                                    return;
                                }
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({
                                    success: true,
                                    message: "数据已成功保存并同步！",
                                    stdout: stdout,
                                }));
                            });
                        }
                        catch (err) {
                            res.statusCode = 500;
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ success: false, error: err.message }));
                        }
                    });
                    return;
                }
                // 4. Git commit and push helper
                if (req.url === "/api/git-push" && req.method === "POST") {
                    var body_2 = "";
                    req.on("data", function (chunk) {
                        body_2 += chunk;
                    });
                    req.on("end", function () {
                        try {
                            var data = body_2 ? JSON.parse(body_2) : {};
                            var commitMsg = data.message || "Update travel traces data";
                            var cmd = "python3 scripts/preprocess.py && git add data/ public/data/ && git commit -m \"".concat(commitMsg.replace(/"/g, '\\"'), "\" && git push");
                            exec(cmd, { cwd: __dirname }, function (error, stdout, stderr) {
                                if (error) {
                                    res.statusCode = 500;
                                    res.setHeader("Content-Type", "application/json");
                                    res.end(JSON.stringify({
                                        success: false,
                                        error: stderr || error.message,
                                        stdout: stdout,
                                    }));
                                    return;
                                }
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({
                                    success: true,
                                    message: "已成功推送到远程仓库！",
                                    stdout: stdout,
                                }));
                            });
                        }
                        catch (err) {
                            res.statusCode = 500;
                            res.setHeader("Content-Type", "application/json");
                            res.end(JSON.stringify({ success: false, error: err.message }));
                        }
                    });
                    return;
                }
                next();
            });
        },
    };
}
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [vue(), localDevApiPlugin()],
    base: "./",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 3000,
        open: false,
    },
});
