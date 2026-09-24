# 个人飞行与高铁足迹 · China Travel Traces

基于 HTML5 Canvas 2D 与 Vue 3 构建的高性能个人中国旅行轨迹可视化工具，支持自动大圆测地线计算、航司品牌色谱匹配、流光粒子动画与明暗主题切换，完全托管于 GitHub Pages。

---

## 🌟 核心特性

- **中国标准投影 (Albers China)**：基于 D3-geo 的等面积圆锥投影，告别墨卡托高纬度拉伸，真实呈现中国版图与省界细线。
- **高精几何与渲染引擎**：
  - **飞行轨迹**：二次贝塞尔拱起金色渐变弧线，支持航司品牌主色渲染与流光粒子循环动画。
  - **高铁轨迹**：经典绿色虚线，平滑连接各大铁路枢纽。
  - **视觉自适应**：线宽与站点半径随地图缩放级别动态反向衰减，缩放清晰不遮挡。
- **流畅交互体验 (Pan & Zoom)**：
  - 硬件级 2D 仿射变换矩阵，支持以鼠标为中心的连续滚轮缩放与全画布平滑拖拽。
  - 射线拾取与贝塞尔曲线碰撞检测：鼠标悬停即时高亮轨迹并弹出行程卡片。
- **多维动态仪表盘**：
  - 实时累计飞行/高铁总里程、等效环绕地球圈数与出行频次。
  - 交通方式比例切片、打卡最多枢纽、常坐航司与常乘高铁排行榜。
  - 支持按「全部 / 仅飞行 / 仅高铁」及各年份时间轴动态过滤。
- **明暗主题状态机**：支持一键在亮色与深蓝黑夜模式之间无缝平滑切换。
- **CI/CD 零维护部署**：基于 Python 预处理脚本与 GitHub Actions，每次推送更新 `data/my_trips.csv` 自动重新构建并发布至 GitHub Pages。

---

## 📁 目录结构

```text
Ticket/
├── .github/workflows/deploy.yml   # GitHub Actions 自动化部署工作流
├── data/                          # 原始数据源
│   ├── airports.js                # 机场数据库、城市与航司色谱
│   ├── station_geo.json           # 3276+ 火车站 WGS-84 经纬度
│   ├── trains_base.json           # 高铁车次基准库
│   ├── world.json                 # 基础地理轮廓
│   └── my_trips.csv               # 个人出行记录原始表（用户日常维护）
├── scripts/
│   └── preprocess.py              # 数据清洗、坐标关联与大圆测地线精算脚本
├── public/data/
│   ├── china_provinces.json       # 精简版中国省界与海岸线 GeoJSON
│   ├── locations.json             # 预处理输出：已打卡站点字典
│   └── trips.json                 # 预处理输出：结构化行程与元统计
└── src/
    ├── core/                      # Canvas 2D、投影与数学引擎
    ├── stores/                    # 响应式状态管理（行程与主题）
    └── components/                # 地图画布、仪表盘与悬浮卡片
```

---

## 📝 记录个人行程 (`data/my_trips.csv`)

直接在 Excel 或文本编辑器中编辑 `data/my_trips.csv`，示例：

```csv
date,type,code,from,to,notes
2024-05-01,flight,CA1501,PEK,SHA,首都-虹桥 国航公务出差
2024-05-04,hsr,G1,北京南,上海虹桥,复兴号 京沪标杆
```

- `date`: 日期 (`YYYY-MM-DD`)
- `type`: `flight` (飞机) 或 `hsr` (高铁)
- `code`: 航班号 (如 `CA1501`) 或车次号 (如 `G1`)
- `from` / `to`: 起止点。飞机支持 IATA 三字码（如 `PEK`）或机场/城市名；高铁支持火车站名（如 `北京南`, `上海虹桥`）。预处理脚本具备智能别名匹配与容错机制。
- `notes`: 选填备注。

---

## 🛠️ 本地运行与构建

### 1. 预处理数据

```bash
python3 scripts/preprocess.py
```

### 2. 启动前端开发服务器

```bash
npm install
npm run dev
```

### 3. 打包生产静态资源

```bash
npm run build
```

---

## 🚀 部署至 GitHub Pages

项目已内置 `.github/workflows/deploy.yml`。只需在 GitHub 仓库中开启 Pages 功能：

1. 进入 GitHub 仓库设置：**Settings** -> **Pages**。
2. 将 **Source** 更改为 **GitHub Actions**。
3. 推送代码到 `main` 分支，工作流将自动执行数据预处理与构建发布。
