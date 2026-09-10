#pragma once

#include <string>
#include <vector>
#include <optional>
#include "json.hpp"

struct Station {
    std::string code;
    std::string name;
    std::string nameEn;
    std::string city;
    std::string country;
    std::string type; // "airport" or "railway_station"
    double longitude = 0.0;
    double latitude = 0.0;

    static Station from_json(const std::string& code, const nlohmann::json& j) {
        Station s;
        s.code = code;
        s.name = j.value("name", code);
        s.nameEn = j.value("nameEn", "");
        s.city = j.value("city", "");
        s.country = j.value("country", "");
        s.type = j.value("type", "airport");
        if (j.contains("coordinates") && j["coordinates"].size() >= 2) {
            s.longitude = j["coordinates"][0].get<double>();
            s.latitude = j["coordinates"][1].get<double>();
        }
        return s;
    }
};

struct Trip {
    std::string id;
    std::string type; // "flight" or "train"
    std::string date; // "YYYY-MM-DD"
    std::string departureCode;
    std::string arrivalCode;
    std::string depTime; // "HH:mm"
    std::string arrTime; // "HH:mm"
    double manualDistanceKm = 0.0;
    std::string remarks;

    // Flight specific
    std::string flightNumber;
    std::string airline;
    std::string aircraft;
    std::string registration;
    std::string cabinClass;
    std::string flightSeat;

    // Train specific
    std::string trainNumber;
    std::string trainType;
    std::string seatClass;
    std::string carriage;
    std::string trainSeat;

    // Computed fields
    double calculatedDistanceKm = 0.0;
    int durationMinutes = 0;

    static Trip from_json(const nlohmann::json& j) {
        Trip t;
        t.id = j.value("id", "");
        t.type = j.value("type", "flight");
        t.date = j.value("date", "");
        t.departureCode = j.value("departure", "");
        t.arrivalCode = j.value("arrival", "");
        t.depTime = j.value("depTime", "");
        t.arrTime = j.value("arrTime", "");
        t.manualDistanceKm = j.value("distanceKm", 0.0);
        t.remarks = j.value("remarks", "");

        if (t.type == "flight") {
            t.flightNumber = j.value("flightNumber", "");
            t.airline = j.value("airline", "");
            t.aircraft = j.value("aircraft", "");
            t.registration = j.value("registration", "");
            t.cabinClass = j.value("cabinClass", "");
            t.flightSeat = j.value("seat", "");
        } else if (t.type == "train") {
            t.trainNumber = j.value("trainNumber", "");
            t.trainType = j.value("trainType", "high_speed");
            t.seatClass = j.value("seatClass", "second_class");
            t.carriage = j.value("carriage", "");
            t.trainSeat = j.value("seat", "");
        }
        return t;
    }
};

