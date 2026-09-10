#include "geo_calc.hpp"
#include <cmath>
#include <algorithm>
#include <string>

namespace geo_calc {

constexpr double PI = 3.14159265358979323846;

inline double deg2rad(double deg) {
    return deg * (PI / 180.0);
}

inline double rad2deg(double rad) {
    return rad * (180.0 / PI);
}

double haversine_distance_km(double lon1, double lat1, double lon2, double lat2) {
    double dlat = deg2rad(lat2 - lat1);
    double dlon = deg2rad(lon2 - lon1);

    double rlat1 = deg2rad(lat1);
    double rlat2 = deg2rad(lat2);

    double a = std::sin(dlat / 2.0) * std::sin(dlat / 2.0) +
               std::cos(rlat1) * std::cos(rlat2) *
               std::sin(dlon / 2.0) * std::sin(dlon / 2.0);

    double c = 2.0 * std::atan2(std::sqrt(a), std::sqrt(1.0 - a));
    return EARTH_RADIUS_KM * c;
}

struct Vec3 {
    double x, y, z;
};

static Vec3 to_cartesian(double lon_deg, double lat_deg) {
    double lon = deg2rad(lon_deg);
    double lat = deg2rad(lat_deg);
    return {
        std::cos(lat) * std::cos(lon),
        std::cos(lat) * std::sin(lon),
        std::sin(lat)
    };
}

static Point2D to_spherical(const Vec3& v) {
    double lat = std::asin(std::clamp(v.z, -1.0, 1.0));
    double lon = std::atan2(v.y, v.x);
    return { rad2deg(lon), rad2deg(lat) };
}

std::vector<Point2D> interpolate_great_circle(
    double lon1, double lat1, 
    double lon2, double lat2, 
    int num_segments
) {
    std::vector<Point2D> path;
    if (num_segments < 2) num_segments = 2;

    Vec3 v1 = to_cartesian(lon1, lat1);
    Vec3 v2 = to_cartesian(lon2, lat2);

    double dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    dot = std::clamp(dot, -1.0, 1.0);
    double omega = std::acos(dot);

    if (omega < 1e-6) {
        path.push_back({lon1, lat1});
        path.push_back({lon2, lat2});
        return path;
    }

    double sin_omega = std::sin(omega);

    path.reserve(num_segments + 1);
    for (int i = 0; i <= num_segments; ++i) {
        double f = static_cast<double>(i) / num_segments;
        double scale1 = std::sin((1.0 - f) * omega) / sin_omega;
        double scale2 = std::sin(f * omega) / sin_omega;

        Vec3 vi = {
            scale1 * v1.x + scale2 * v2.x,
            scale1 * v1.y + scale2 * v2.y,
            scale1 * v1.z + scale2 * v2.z
        };

        // Normalize vector
        double norm = std::sqrt(vi.x * vi.x + vi.y * vi.y + vi.z * vi.z);
        if (norm > 0.0) {
            vi.x /= norm;
            vi.y /= norm;
            vi.z /= norm;
        }

        path.push_back(to_spherical(vi));
    }

    return path;
}

int calculate_duration_minutes(const std::string& dep_time, const std::string& arr_time) {
    if (dep_time.size() < 5 || arr_time.size() < 5) return 0;
    try {
        int h1 = std::stoi(dep_time.substr(0, 2));
        int m1 = std::stoi(dep_time.substr(3, 2));
        int h2 = std::stoi(arr_time.substr(0, 2));
        int m2 = std::stoi(arr_time.substr(3, 2));

        int t1 = h1 * 60 + m1;
        int t2 = h2 * 60 + m2;
        int diff = t2 - t1;
        if (diff < 0) {
            diff += 24 * 60; // Next day arrival assumption
        }
        return diff;
    } catch (...) {
        return 0;
    }
}

} // namespace geo_calc

