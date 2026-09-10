#pragma once

#include <vector>
#include <utility>
#include <string>

namespace geo_calc {

// Earth mean radius in kilometers
constexpr double EARTH_RADIUS_KM = 6371.0088;

// Coordinate pair: [longitude, latitude] in degrees
using Point2D = std::pair<double, double>;

// Calculate great circle distance between two points in kilometers
double haversine_distance_km(double lon1, double lat1, double lon2, double lat2);

// Generate intermediate points along great circle arc between point1 and point2
// Returns array of [longitude, latitude] coordinates
std::vector<Point2D> interpolate_great_circle(
    double lon1, double lat1, 
    double lon2, double lat2, 
    int num_segments = 50
);

// Calculate trip duration in minutes from "HH:mm" strings
int calculate_duration_minutes(const std::string& dep_time, const std::string& arr_time);

} // namespace geo_calc
