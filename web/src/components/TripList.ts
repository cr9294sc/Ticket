import { TripItem } from '../types/schema';

export class TripList {
  private containerId: string;
  private allTrips: TripItem[] = [];

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  public init(trips: TripItem[]) {
    this.allTrips = trips;
    this.render(this.allTrips);
  }

  public filter(year: string, type: string) {
    let filtered = this.allTrips;

    if (year !== 'all') {
      filtered = filtered.filter(t => t.date.startsWith(year));
    }

    if (type !== 'all') {
      filtered = filtered.filter(t => t.type === type);
    }

    this.render(filtered);
  }

  private render(trips: TripItem[]) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const countEl = document.getElementById('trips-count-badge');
    if (countEl) {
      countEl.innerText = `${trips.length} 条记录`;
    }

    if (trips.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 2rem;">
          没有匹配的行程记录
        </div>
      `;
      return;
    }

    container.innerHTML = trips.map(trip => this.createCardHTML(trip)).join('');
  }

  private createCardHTML(t: TripItem): string {
    const isFlight = t.type === 'flight';
    const typeClass = isFlight ? 'flight' : 'train';
    const typeIcon = isFlight ? '✈️' : '🚆';
    const typeLabel = isFlight ? '航班' : '列车';
    const code = isFlight ? t.flightNumber : t.trainNumber;

    let subTags = '';
    if (isFlight) {
      if (t.airline) subTags += `<span class="detail-tag">${t.airline}</span>`;
      if (t.aircraft) subTags += `<span class="detail-tag">${t.aircraft}</span>`;
      if (t.cabinClass) subTags += `<span class="detail-tag">${this.formatCabin(t.cabinClass)}</span>`;
      if (t.seat) subTags += `<span class="detail-tag">座号 ${t.seat}</span>`;
    } else {
      if (t.seatClass) subTags += `<span class="detail-tag">${this.formatTrainSeat(t.seatClass)}</span>`;
      if (t.carriage && t.seat) subTags += `<span class="detail-tag">${t.carriage}车 ${t.seat}</span>`;
    }

    const durationStr = t.durationMinutes > 0 
      ? `${Math.floor(t.durationMinutes / 60)}h ${t.durationMinutes % 60}m`
      : '';

    return `
      <div class="trip-card ${typeClass}">
        <div class="trip-card-header">
          <span class="trip-type-badge">${typeIcon} ${code || typeLabel}</span>
          <span class="trip-date">${t.date}</span>
        </div>

        <div class="trip-route">
          <div class="route-station">
            <div>${t.departureCity || t.departure}</div>
            <div style="font-size: 0.75rem; font-weight: normal; color: #9ca3af;">${t.departureName}</div>
          </div>
          <span class="route-arrow">⟶</span>
          <div class="route-station" style="text-align: right;">
            <div>${t.arrivalCity || t.arrival}</div>
            <div style="font-size: 0.75rem; font-weight: normal; color: #9ca3af;">${t.arrivalName}</div>
          </div>
        </div>

        <div class="trip-details">
          <span class="detail-tag">里程: ${t.distanceKm.toLocaleString()} km</span>
          ${durationStr ? `<span class="detail-tag">时长: ${durationStr}</span>` : ''}
          ${subTags}
        </div>

        ${t.remarks ? `<div class="trip-remarks">"${t.remarks}"</div>` : ''}
      </div>
    `;
  }

  private formatCabin(cabin: string): string {
    const map: Record<string, string> = {
      economy: '经济舱',
      premium_economy: '超级经济舱',
      business: '公务/商务舱',
      first: '头等舱'
    };
    return map[cabin] || cabin;
  }

  private formatTrainSeat(seat: string): string {
    const map: Record<string, string> = {
      second_class: '二等座',
      first_class: '一等座',
      business_class: '商务座',
      soft_sleeper: '软卧',
      hard_sleeper: '硬卧',
      hard_seat: '硬座',
      standing: '无座'
    };
    return map[seat] || seat;
  }
}
