#pragma once

#include <string>
#include <vector>
#include <map>
#include <set>
#include "models.hpp"
#include "json.hpp"

class StatsCollector {
public:
    void process(
        const std::vector<Trip>& trips,
        const std::map<std::string, Station>& stations
    );

    nlohmann::json to_stats_json() const;
    nlohmann::json to_routes_geojson() const;
    nlohmann::json to_stations_geojson() const;

private:
    struct YearSummary {
        int totalTrips = 0;
        double totalDistanceKm = 0.0;
        int flightTrips = 0;
        double flightDistanceKm = 0.0;
        int trainTrips = 0;
        double trainDistanceKm = 0.0;
    };

    struct RouteStat {
        std::string departureCode;
        std::string arrivalCode;
        std::string type;
        int count = 0;
        double distanceKm = 0.0;
        std::vector<std::pair<double, double>> geometry; // Coordinates
        std::string lastDate;
    };

    struct StationUsage {
        Station station;
        int visitCount = 0;
        int departureCount = 0;
        int arrivalCount = 0;
    };

    // Summary data
    int totalTrips_ = 0;
    double totalDistanceKm_ = 0.0;
    int totalDurationMinutes_ = 0;

    int flightTrips_ = 0;
    double flightDistanceKm_ = 0.0;

    int trainTrips_ = 0;
    double trainDistanceKm_ = 0.0;

    std::map<std::string, YearSummary> yearlyStats_;
    std::map<std::string, int> aircraftStats_;
    std::map<std::string, int> airlineStats_;
    std::map<std::string, int> flightCabinStats_;
    std::map<std::string, int> trainSeatStats_;
    std::map<std::string, int> cityVisits_;
    std::set<std::string> visitedCountries_;
    std::set<std::string> visitedCities_;

    std::map<std::string, StationUsage> stationUsageMap_;
    std::map<std::string, RouteStat> routeStatsMap_;
    std::vector<nlohmann::json> enrichedTrips_;
};

