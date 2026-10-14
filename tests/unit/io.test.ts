import { describe, it, expect } from "vitest";
import { parseCsv, tripsToCsv, tripsToJson } from "../../src/core/io";
import type { TripEntity } from "../../src/types/travel";

describe("io utilities", () => {
  describe("parseCsv", () => {
    it("parses simple CSV rows without quotes", () => {
      const csv = "date,type,code\n2024-01-01,flight,CA123\n2024-01-02,hsr,G1";
      const rows = parseCsv(csv);
      expect(rows).toEqual([
        ["date", "type", "code"],
        ["2024-01-01", "flight", "CA123"],
        ["2024-01-02", "hsr", "G1"],
      ]);
    });

    it("handles escaped quotes, commas, and multiline values within quotes", () => {
      const csv = `name,notes\n"Beijing","City, capital"\n"Shanghai","Contains ""quotes"""`;
      const rows = parseCsv(csv);
      expect(rows.length).toBe(3);
      expect(rows[1][0]).toBe("Beijing");
      expect(rows[1][1]).toBe("City, capital");
      expect(rows[2][0]).toBe("Shanghai");
      expect(rows[2][1]).toBe('Contains "quotes"');
    });

    it("strips UTF-8 BOM automatically", () => {
      const csvWithBom = "\ufeffdate,type\n2024-01-01,flight";
      const rows = parseCsv(csvWithBom);
      expect(rows[0][0]).toBe("date");
    });
  });

  describe("tripsToCsv and serialization", () => {
    const mockTrip: TripEntity = {
      id: "trip-1",
      type: "FLIGHT",
      code: "CA101",
      date: "2024-05-01",
      year: 2024,
      originId: "PEK",
      originName: "北京首都",
      originCity: "北京",
      originCoords: [116.4, 39.9],
      destId: "SHA",
      destName: "上海虹桥",
      destCity: "上海",
      destCoords: [121.4, 31.2],
      distanceKm: 1080,
      color: "#ff0000",
      notes: "Business trip, sunny",
    };

    it("exports trips to well-formatted CSV with headers and BOM", () => {
      const csv = tripsToCsv([mockTrip]);
      expect(csv.startsWith("\ufeffdate,type,code")).toBe(true);
      expect(csv).toContain("2024-05-01");
      expect(csv).toContain("CA101");
      expect(csv).toContain('"Business trip, sunny"');
    });

    it("exports trips to valid JSON string", () => {
      const jsonStr = tripsToJson([mockTrip]);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.version).toBe(1);
      expect(Array.isArray(parsed.trips)).toBe(true);
      expect(parsed.trips.length).toBe(1);
      expect(parsed.trips[0].id).toBe("trip-1");
    });
  });
});
