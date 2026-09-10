# ✈️ 🚆 TripTracker - 个人火车/飞机行程统计与轨迹可视化网站

一个基于 **静态生成（SSG）** 架构的个人旅行轨迹与里程统计脚手架项目，专为托管于 **GitHub Pages** 设计。

本地或 CI 维护原始 JSON 数据，由高性能 **C++ 引擎** 完成球面大圆航线插值、地理测距与指标统计，生成标准 GeoJSON 与统计 JSON，最后由前端使用 **MapLibre GL JS** 和 **Apache ECharts** 进行高质感可视化展示。

---

## 🌟 项目特性

- **现代 C++ 数据引擎 (`engine/`)**：
  - 基于 C++17，零外部依赖（内置轻量级兼容 `nlohmann::json` 的解析器）。
  - **Haversine 球面测距**：精准计算机场与车站之间的地理直线距离。
  - **Great Circle 大圆航线插值 (Slerp)**：为飞机航线生成逼真平滑的球面弧线坐标，原生支持跨越日界线渲染。
  - **自动化指标聚合**：自动输出总里程、出行用时、年度趋势、交通方式占比、机型车型偏好以及打卡城市排行。
- **高颜值交互前端 (`web/`)**：
  - **MapLibre GL 地图**：炫酷暗黑底图、发光航线弧线、虚线铁路线、车站 Marker 智能聚合 (Clustering) 与浮窗交互。
  - **ECharts 数据面板**：历年趋势混合图、出行方式环形图、搭乘机型分布、常去城市排行。
  - **行程明细卡片**：时间倒序排列、区分飞机/高铁卡片、支持按年份与出行类型即时筛选。
- **GitHub Actions 全自动流水线 (`deploy.yml`)**：
  - 每次推送到 `main` 分支自动编译 C++ 程序 -> 转换数据 -> 构建前端 -> 部署至 GitHub Pages，无需手动维护构建产物。

---

## 📁 项目目录结构

```
Ticket/
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions 自动化构建与 Pages 发布工作流
├── data/                           # 核心数据源（用户维护）
│   ├── trips.json                  # 行程清单（包含飞机与火车）
│   ├── trips.schema.json           # trips.json 的标准 JSON Schema 校验文件
│   └── stations.json               # 机场三字码与火车站经纬度词典
├── engine/                         # C++ 数据处理与空间计算引擎
│   ├── CMakeLists.txt              # CMake 构建工程
│   ├── include/
│   │   ├── geo_calc.hpp            # 大圆测距与球面弧线插值算法
│   │   ├── json.hpp                # 轻量级现代 JSON 库
│   │   ├── models.hpp              # 行程与站点实体定义
│   │   └── stats_collector.hpp     # 统计分析与 GeoJSON 导出器
│   └── src/
│       ├── geo_calc.cpp
│       ├── main.cpp                # 命令行主程序
│       └── stats_collector.cpp
├── web/                            # 前端展示层
│   ├── index.html                  # 静态主页
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts              # Vite 打包配置
│   ├── public/
│   │   └── data/                   # C++ 引擎生成的静态数据（供前端请求）
│   │       ├── routes.geojson      # 航线轨迹与空间坐标
│   │       ├── stations.geojson    # 站点打卡点与访问频次
│   │       └── stats.json          # 聚合统计数据与行程明细
│   └── src/
│       ├── main.ts                 # 前端核心逻辑与事件绑定
│       ├── styles/main.css         # 暗黑模式响应式样式
│       ├── components/
│       │   ├── MapViewer.ts        # MapLibre 地图组件
│       │   ├── StatsDashboard.ts   # ECharts 仪表盘组件
│       │   └── TripList.ts         # 行程卡片流组件
│       └── types/schema.ts         # TypeScript 数据类型定义
├── .gitignore
└── README.md
```

---

## 📝 数据录入说明

### 1. 站点字典 (`data/stations.json`)
新增站点或机场时，只需在此录入一次经纬度与城市名：
```json
"HND": {
  "name": "东京羽田机场",
  "city": "东京",
  "country": "日本",
  "type": "airport",
  "coordinates": [139.781, 35.549]
},
"北京南": {
  "name": "北京南站",
  "city": "北京",
  "country": "中国",
  "type": "railway_station",
  "coordinates": [116.379, 39.865]
}
```

### 2. 行程记录 (`data/trips.json`)
支持通过 `type` 字段区分飞机 (`flight`) 与火车 (`train`)：

#### ✈️ 飞机示例
```json
{
  "id": "TRIP-2026-001",
  "type": "flight",
  "date": "2026-08-15",
  "departure": "PEK",
  "arrival": "HND",
  "depTime": "08:30",
  "arrTime": "12:50",
  "flightNumber": "NH962",
  "airline": "全日空航空",
  "aircraft": "B787-9",
  "cabinClass": "business",
  "seat": "03A",
  "remarks": "东京度假"
}
```

#### 🚆 火车示例
```json
{
  "id": "TRIP-2026-003",
  "type": "train",
  "date": "2026-06-10",
  "departure": "北京南",
  "arrival": "上海虹桥",
  "depTime": "09:00",
  "arrTime": "13:28",
  "trainNumber": "G1",
  "trainType": "high_speed",
  "seatClass": "business_class",
  "carriage": "01",
  "seat": "02F",
  "remarks": "京沪高铁体验"
}
```

---

## 🛠️ 本地运行与调试

### 步骤 1：编译与运行 C++ 引擎
确保本地具备 `cmake` 和 `g++` (或 clang++)：
```bash
# 1. 编译
cmake -B build engine
cmake --build build

# 2. 运行引擎生成数据
./build/trip_engine --trips data/trips.json --stations data/stations.json --out web/public/data
```

### 步骤 2：启动前端预览
**方法 A：直接使用 Python 本地服务器（免安装 Node 依赖）**：
```bash
cd web
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

**方法 B：使用 Vite 开发调试**：
```bash
cd web
npm install
npm run dev
```

---

## 🚀 部署到 GitHub Pages

1. 将代码推送到 GitHub 仓库的 `main` 分支。
2. 进入 GitHub 仓库设置：**Settings** -> **Pages**。
3. 在 **Build and deployment** -> **Source** 下选择：`GitHub Actions`。
4. 随后每次提交新行程到 `trips.json`，GitHub Actions 将全自动编译引擎、计算轨迹并发布到 `https://<your-username>.github.io/<repo-name>/`。

