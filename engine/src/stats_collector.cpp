#include "stats_collector.hpp"
#include "geo_calc.hpp"
#include <algorithm>
#include <cmath>

void StatsCollector::process(
    const std::vector<Trip>& trips,
    const std::map<std::string, Station>& stations
) {
    totalTrips_ = 0;
    totalDistanceKm_ = 0.0;
    totalDurationMinutes_ = 0;
    flightTrips_ = 0;
    flightDistanceKm_ = 0.0;
    trainTrips_ = 0;
    trainDistanceKm_ = 0.0;

    yearlyStats_.clear();
    aircraftStats_.clear();
    airlineStats_.clear();
    flightCabinStats_.clear();
    trainSeatStats_.clear();
    cityVisits_.clear();
    visitedCountries_.clear();
    visitedCities_.clear();
    stationUsageMap_.clear();
    routeStatsMap_.clear();
    enrichedTrips_.clear();

    for (const auto& trip : trips) {
        Trip enriched = trip;

        // Lookup stations
        auto depIt = stations.find(trip.departureCode);
        auto arrIt = stations.find(trip.arrivalCode);

        Station depStation = (depIt != stations.end()) ? depIt->second : Station{trip.departureCode, trip.departureCode, "", "", "", "", 0, 0};
        Station arrStation = (arrIt != stations.end()) ? arrIt->second : Station{trip.arrivalCode, trip.arrivalCode, "", "", "", "", 0, 0};

        // Calculate distance if not manually specified
        if (enriched.manualDistanceKm > 0.0) {
            enriched.calculatedDistanceKm = enriched.manualDistanceKm;
        } else if (depIt != stations.end() && arrIt != stations.end()) {
            enriched.calculatedDistanceKm = geo_calc::haversine_distance_km(
                depStation.longitude, depStation.latitude,
                arrStation.longitude, arrStation.latitude
            );
        } else {
            enriched.calculatedDistanceKm = 0.0;
        }

        // Calculate duration
        enriched.durationMinutes = geo_calc::calculate_duration_minutes(trip.depTime, trip.arrTime);

        // Global stats
        totalTrips_++;
        totalDistanceKm_ += enriched.calculatedDistanceKm;
        totalDurationMinutes_ += enriched.durationMinutes;

        // Yearly stats
        std::string year = (trip.date.size() >= 4) ? trip.date.substr(0, 4) : "Unknown";
        auto& yr = yearlyStats_[year];
        yr.totalTrips++;
        yr.totalDistanceKm += enriched.calculatedDistanceKm;

        if (trip.type == "flight") {
            flightTrips_++;
            flightDistanceKm_ += enriched.calculatedDistanceKm;
            yr.flightTrips++;
            yr.flightDistanceKm += enriched.calculatedDistanceKm;

            if (!trip.aircraft.empty()) aircraftStats_[trip.aircraft]++;
            if (!trip.airline.empty()) airlineStats_[trip.airline]++;
            if (!trip.cabinClass.empty()) flightCabinStats_[trip.cabinClass]++;
        } else if (trip.type == "train") {
            trainTrips_++;
            trainDistanceKm_ += enriched.calculatedDistanceKm;
            yr.trainTrips++;
            yr.trainDistanceKm += enriched.calculatedDistanceKm;

            if (!trip.seatClass.empty()) trainSeatStats_[trip.seatClass]++;
        }

        // Station usage
        if (!depStation.code.empty()) {
            auto& su = stationUsageMap_[depStation.code];
            su.station = depStation;
            su.visitCount++;
            su.departureCount++;
            if (!depStation.city.empty()) {
                cityVisits_[depStation.city]++;
                visitedCities_.insert(depStation.city);
            }
            if (!depStation.country.empty()) visitedCountries_.insert(depStation.country);
        }

        if (!arrStation.code.empty()) {
            auto& su = stationUsageMap_[arrStation.code];
            su.station = arrStation;
            su.visitCount++;
            su.arrivalCount++;
            if (!arrStation.city.empty()) {
                cityVisits_[arrStation.city]++;
                visitedCities_.insert(arrStation.city);
            }
            if (!arrStation.country.empty()) visitedCountries_.insert(arrStation.country);
        }

        // Route stats & geometry
        std::string routeKey = (depStation.code < arrStation.code) ?
            (depStation.code + "-" + arrStation.code + "-" + trip.type) :
            (arrStation.code + "-" + depStation.code + "-" + trip.type);

        auto& rStat = routeStatsMap_[routeKey];
        rStat.departureCode = depStation.code;
        rStat.arrivalCode = arrStation.code;
        rStat.type = trip.type;
        rStat.count++;
        rStat.distanceKm = enriched.calculatedDistanceKm;
        rStat.lastDate = trip.date;

        if (rStat.geometry.empty() && depIt != stations.end() && arrIt != stations.end()) {
            if (trip.type == "flight") {
                rStat.geometry = geo_calc::interpolate_great_circle(
                    depStation.longitude, depStation.latitude,
                    arrStation.longitude, arrStation.latitude,
                    60
                );
            } else {
                rStat.geometry.push_back({depStation.longitude, depStation.latitude});
                rStat.geometry.push_back({arrStation.longitude, arrStation.latitude});
            }
        }

        // Save enriched trip object
        nlohmann::json item = nlohmann::json::object();
        item["id"] = enriched.id;
        item["type"] = enriched.type;
        item["date"] = enriched.date;
        item["departure"] = enriched.departureCode;
        item["departureName"] = depStation.name;
        item["departureCity"] = depStation.city;
        item["arrival"] = enriched.arrivalCode;
        item["arrivalName"] = arrStation.name;
        item["arrivalCity"] = arrStation.city;
        item["depTime"] = enriched.depTime;
        item["arrTime"] = enriched.arrTime;
        item["distanceKm"] = std::round(enriched.calculatedDistanceKm);
        item["durationMinutes"] = enriched.durationMinutes;
        item["remarks"] = enriched.remarks;

        if (enriched.type == "flight") {
            item["flightNumber"] = enriched.flightNumber;
            item["airline"] = enriched.airline;
            item["aircraft"] = enriched.aircraft;
            item["registration"] = enriched.registration;
            item["cabinClass"] = enriched.cabinClass;
            item["seat"] = enriched.flightSeat;
        } else {
            item["trainNumber"] = enriched.trainNumber;
            item["trainType"] = enriched.trainType;
            item["seatClass"] = enriched.seatClass;
            item["carriage"] = enriched.carriage;
            item["seat"] = enriched.trainSeat;
        }
        enrichedTrips_.push_back(item);
    }

    // Sort enriched trips by date descending
    std::sort(enrichedTrips_.begin(), enrichedTrips_.end(), [](const nlohmann::json& a, const nlohmann::json& b) {
        return a["date"].get<std::string>() > b["date"].get<std::string>();
    });
}

nlohmann::json StatsCollector::to_stats_json() const {
    nlohmann::json root = nlohmann::json::object();

    // Summary KPIs
    nlohmann::json summary = nlohmann::json::object();
    summary["totalTrips"] = totalTrips_;
    summary["totalDistanceKm"] = std::round(totalDistanceKm_);
    summary["totalDurationMinutes"] = totalDurationMinutes_;
    summary["flightTrips"] = flightTrips_;
    summary["flightDistanceKm"] = std::round(flightDistanceKm_);
    summary["trainTrips"] = trainTrips_;
    summary["trainDistanceKm"] = std::round(trainDistanceKm_);
    summary["visitedCitiesCount"] = static_cast<int>(visitedCities_.size());
    summary["visitedCountriesCount"] = static_cast<int>(visitedCountries_.size());
    summary["activeRoutesCount"] = static_cast<int>(routeStatsMap_.size());
    root["summary"] = summary;

    // Yearly Breakdown
    nlohmann::json yearly = nlohmann::json::object();
    for (const auto& [year, ydata] : yearlyStats_) {
        nlohmann::json yObj = nlohmann::json::object();
        yObj["totalTrips"] = ydata.totalTrips;
        yObj["totalDistanceKm"] = std::round(ydata.totalDistanceKm);
        yObj["flightTrips"] = ydata.flightTrips;
        yObj["flightDistanceKm"] = std::round(ydata.flightDistanceKm);
        yObj["trainTrips"] = ydata.trainTrips;
        yObj["trainDistanceKm"] = std::round(ydata.trainDistanceKm);
        yearly[year] = yObj;
    }
    root["yearly"] = yearly;

    // Top Cities
    std::vector<std::pair<std::string, int>> cityList(cityVisits_.begin(), cityVisits_.end());
    std::sort(cityList.begin(), cityList.end(), [](const auto& a, const auto& b) {
        return a.second > b.second;
    });
    nlohmann::json topCities = nlohmann::json::array();
    for (size_t i = 0; i < std::min<size_t>(cityList.size(), 10); ++i) {
        nlohmann::json c = nlohmann::json::object();
        c["city"] = cityList[i].first;
        c["count"] = cityList[i].second;
        topCities.push_back(c);
    }
    root["topCities"] = topCities;

    // Aircraft distribution
    nlohmann::json aircraftJson = nlohmann::json::object();
    for (const auto& [ac, cnt] : aircraftStats_) {
        aircraftJson[ac] = cnt;
    }
    root["aircraftDistribution"] = aircraftJson;

    // Airline distribution
    nlohmann::json airlineJson = nlohmann::json::object();
    for (const auto& [al, cnt] : airlineStats_) {
        airlineJson[al] = cnt;
    }
    root["airlineDistribution"] = airlineJson;

    // Cabin class distribution
    nlohmann::json cabinJson = nlohmann::json::object();
    for (const auto& [c, cnt] : flightCabinStats_) {
        cabinJson[c] = cnt;
    }
    root["cabinClassDistribution"] = cabinJson;

    // Train seat distribution
    nlohmann::json trainSeatJson = nlohmann::json::object();
    for (const auto& [s, cnt] : trainSeatStats_) {
        trainSeatJson[s] = cnt;
    }
    root["trainSeatDistribution"] = trainSeatJson;

    // Detailed Trips list
    root["trips"] = enrichedTrips_;

    return root;
}

nlohmann::json StatsCollector::to_routes_geojson() const {
    nlohmann::json geo = nlohmann::json::object();
    geo["type"] = "FeatureCollection";
    nlohmann::json features = nlohmann::json::array();

    for (const auto& [key, rstat] : routeStatsMap_) {
        if (rstat.geometry.empty()) continue;

        nlohmann::json feat = nlohmann::json::object();
        feat["type"] = "Feature";

        nlohmann::json props = nlohmann::json::object();
        props["departure"] = rstat.departureCode;
        props["arrival"] = rstat.arrivalCode;
        props["type"] = rstat.type;
        props["frequency"] = rstat.count;
        props["distanceKm"] = std::round(rstat.distanceKm);
        props["lastDate"] = rstat.lastDate;
        feat["properties"] = props;

        nlohmann::json geom = nlohmann::json::object();
        geom["type"] = "LineString";
        nlohmann::json coords = nlohmann::json::array();
        for (const auto& pt : rstat.geometry) {
            nlohmann::json p = nlohmann::json::array();
            p.push_back(pt.first);
            p.push_back(pt.second);
            coords.push_back(p);
        }
        geom["coordinates"] = coords;
        feat["geometry"] = geom;

        features.push_back(feat);
    }

    geo["features"] = features;
    return geo;
}

nlohmann::json StatsCollector::to_stations_geojson() const {
    nlohmann::json geo = nlohmann::json::object();
    geo["type"] = "FeatureCollection";
    nlohmann::json features = nlohmann::json::array();

    for (const auto& [code, su] : stationUsageMap_) {
        if (su.station.longitude == 0.0 && su.station.latitude == 0.0) continue;

        nlohmann::json feat = nlohmann::json::object();
        feat["type"] = "Feature";

        nlohmann::json props = nlohmann::json::object();
        props["code"] = su.station.code;
        props["name"] = su.station.name;
        props["nameEn"] = su.station.nameEn;
        props["city"] = su.station.city;
        props["country"] = su.station.country;
        props["type"] = su.station.type;
        props["visitCount"] = su.visitCount;
        props["departureCount"] = su.departureCount;
        props["arrivalCount"] = su.arrivalCount;
        feat["properties"] = props;

        nlohmann::json geom = nlohmann::json::object();
        geom["type"] = "Point";
        nlohmann::json coords = nlohmann::json::array();
        coords.push_back(su.station.longitude);
        coords.push_back(su.station.latitude);
        geom["coordinates"] = coords;
        feat["geometry"] = geom;

        features.push_back(feat);
    }

    geo["features"] = features;
    return geo;
}

