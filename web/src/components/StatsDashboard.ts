import { StatsPayload } from '../types/schema';

declare const echarts: any;

export class StatsDashboard {
  private trendChartInstance: any = null;
  private modeChartInstance: any = null;
  private fleetChartInstance: any = null;
  private cityChartInstance: any = null;

  public init(stats: StatsPayload) {
    this.renderKPIs(stats);
    this.initTrendChart(stats);
    this.initModeChart(stats);
    this.initFleetChart(stats);
    this.initCityChart(stats);

    window.addEventListener('resize', () => {
      this.trendChartInstance?.resize();
      this.modeChartInstance?.resize();
      this.fleetChartInstance?.resize();
      this.cityChartInstance?.resize();
    });
  }

  private renderKPIs(stats: StatsPayload) {
    const s = stats.summary;
    const totalDistEl = document.getElementById('kpi-total-dist');
    const totalTripsEl = document.getElementById('kpi-total-trips');
    const totalHoursEl = document.getElementById('kpi-total-hours');
    const flightDistEl = document.getElementById('kpi-flight-dist');
    const trainDistEl = document.getElementById('kpi-train-dist');
    const placesEl = document.getElementById('kpi-places');

    if (totalDistEl) totalDistEl.innerText = `${s.totalDistanceKm.toLocaleString()} km`;
    if (totalTripsEl) totalTripsEl.innerText = `${s.totalTrips} 次`;
    if (totalHoursEl) totalHoursEl.innerText = `${(s.totalDurationMinutes / 60).toFixed(1)} h`;
    if (flightDistEl) flightDistEl.innerText = `${s.flightDistanceKm.toLocaleString()} km (${s.flightTrips}次)`;
    if (trainDistEl) trainDistEl.innerText = `${s.trainDistanceKm.toLocaleString()} km (${s.trainTrips}次)`;
    if (placesEl) placesEl.innerText = `${s.visitedCitiesCount} 城 · ${s.visitedCountriesCount} 国`;
  }

  private initTrendChart(stats: StatsPayload) {
    const el = document.getElementById('chart-trend');
    if (!el) return;
    this.trendChartInstance = echarts.init(el, 'dark');

    const years = Object.keys(stats.yearly).sort();
    const flightDist = years.map(y => stats.yearly[y].flightDistanceKm);
    const trainDist = years.map(y => stats.yearly[y].trainDistanceKm);
    const trips = years.map(y => stats.yearly[y].totalTrips);

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['飞机里程 (km)', '高铁里程 (km)', '总行程数 (次)'],
        textStyle: { color: '#9ca3af' },
        top: 0
      },
      grid: { left: '3%', right: '4%', bottom: '5%', top: '18%', containLabel: true },
      xAxis: {
        type: 'category',
        data: years,
        axisLine: { lineStyle: { color: '#4b5563' } }
      },
      yAxis: [
        {
          type: 'value',
          name: '里程 (km)',
          nameTextStyle: { color: '#9ca3af' },
          splitLine: { lineStyle: { color: '#374151' } }
        },
        {
          type: 'value',
          name: '行程数',
          nameTextStyle: { color: '#9ca3af' },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: '飞机里程 (km)',
          type: 'bar',
          stack: 'dist',
          data: flightDist,
          itemStyle: { color: '#38bdf8' }
        },
        {
          name: '高铁里程 (km)',
          type: 'bar',
          stack: 'dist',
          data: trainDist,
          itemStyle: { color: '#fb923c' }
        },
        {
          name: '总行程数 (次)',
          type: 'line',
          yAxisIndex: 1,
          data: trips,
          itemStyle: { color: '#a855f7' },
          lineStyle: { width: 3 }
        }
      ]
    };
    this.trendChartInstance.setOption(option);
  }

  private initModeChart(stats: StatsPayload) {
    const el = document.getElementById('chart-mode');
    if (!el) return;
    this.modeChartInstance = echarts.init(el, 'dark');

    const s = stats.summary;
    const option = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: '5%', left: 'center', textStyle: { color: '#9ca3af' } },
      series: [
        {
          name: '里程占比',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: false,
          label: { show: true, formatter: '{b}\n{d}%', color: '#e5e7eb' },
          data: [
            { value: s.flightDistanceKm, name: '飞机里程 (km)', itemStyle: { color: '#38bdf8' } },
            { value: s.trainDistanceKm, name: '火车里程 (km)', itemStyle: { color: '#fb923c' } }
          ]
        }
      ]
    };
    this.modeChartInstance.setOption(option);
  }

  private initFleetChart(stats: StatsPayload) {
    const el = document.getElementById('chart-fleet');
    if (!el) return;
    this.fleetChartInstance = echarts.init(el, 'dark');

    const aircraftData = Object.entries(stats.aircraftDistribution)
      .sort((a, b) => a[1] - b[1]);

    const option = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '8%', bottom: '5%', top: '5%', containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#374151' } }
      },
      yAxis: {
        type: 'category',
        data: aircraftData.map(d => d[0]),
        axisLine: { lineStyle: { color: '#4b5563' } }
      },
      series: [
        {
          name: '搭乘次数',
          type: 'bar',
          data: aircraftData.map(d => d[1]),
          itemStyle: {
            color: '#38bdf8',
            borderRadius: [0, 4, 4, 0]
          },
          label: {
            show: true,
            position: 'right',
            color: '#e5e7eb'
          }
        }
      ]
    };
    this.fleetChartInstance.setOption(option);
  }

  private initCityChart(stats: StatsPayload) {
    const el = document.getElementById('chart-city');
    if (!el) return;
    this.cityChartInstance = echarts.init(el, 'dark');

    const topCities = [...stats.topCities].reverse();

    const option = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '8%', bottom: '5%', top: '5%', containLabel: true },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#374151' } }
      },
      yAxis: {
        type: 'category',
        data: topCities.map(c => c.city),
        axisLine: { lineStyle: { color: '#4b5563' } }
      },
      series: [
        {
          name: '访问频次',
          type: 'bar',
          data: topCities.map(c => c.count),
          itemStyle: {
            color: '#818cf8',
            borderRadius: [0, 4, 4, 0]
          },
          label: {
            show: true,
            position: 'right',
            color: '#e5e7eb'
          }
        }
      ]
    };
    this.cityChartInstance.setOption(option);
  }
}
