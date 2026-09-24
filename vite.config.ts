import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
import fs from "fs";
import { exec } from "child_process";

function localDevApiPlugin() {
  return {
    name: "local-dev-api-plugin",
    configureServer(server: any) {
      // 1. Check if running in local dev mode
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === "/api/dev-status") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ isDev: true }));
          return;
        }

        // 2. Load raw CSV data
        if (req.url === "/api/load-csv" && req.method === "GET") {
          const csvPath = path.resolve(__dirname, "data/my_trips.csv");
          try {
            const content = fs.existsSync(csvPath)
              ? fs.readFileSync(csvPath, "utf-8")
              : "";
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, content }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        // 3. Save CSV and execute python preprocess
        if (req.url === "/api/save-csv" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const data = JSON.parse(body);
              const csvContent = data.content;
              const csvPath = path.resolve(__dirname, "data/my_trips.csv");
              fs.writeFileSync(csvPath, csvContent, "utf-8");

              // Run preprocessing script
              exec(
                "python3 scripts/preprocess.py",
                { cwd: __dirname },
                (error, stdout, stderr) => {
                  if (error) {
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    res.end(
                      JSON.stringify({
                        success: false,
                        error: stderr || error.message,
                        stdout,
                      }),
                    );
                    return;
                  }
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      success: true,
                      message: "数据已成功保存并同步！",
                      stdout,
                    }),
                  );
                },
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 4. Git commit and push helper
        if (req.url === "/api/git-push" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk: any) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const commitMsg = data.message || "Update travel traces data";
              const cmd = `python3 scripts/preprocess.py && git add data/ public/data/ && git commit -m "${commitMsg.replace(/"/g, '\\"')}" && git push`;

              exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
                if (error) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      success: false,
                      error: stderr || error.message,
                      stdout,
                    }),
                  );
                  return;
                }
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    success: true,
                    message: "已成功推送到远程仓库！",
                    stdout,
                  }),
                );
              });
            } catch (err: any) {
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
