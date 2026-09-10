#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <string>
#include <map>
#include <vector>

#include "json.hpp"
#include "models.hpp"
#include "stats_collector.hpp"

namespace fs = std::filesystem;

std::string read_file_to_string(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Could not open file: " + path);
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

void write_string_to_file(const std::string& path, const std::string& content) {
    std::ofstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Could not write to file: " + path);
    }
    file << content;
}

int main(int argc, char* argv[]) {
    std::string trips_path = "data/trips.json";
    std::string stations_path = "data/stations.json";
    std::string out_dir = "web/public/data";

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--trips" && i + 1 < argc) {
            trips_path = argv[++i];
        } else if (arg == "--stations" && i + 1 < argc) {
            stations_path = argv[++i];
        } else if (arg == "--out" && i + 1 < argc) {
            out_dir = argv[++i];
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: " << argv[0] << " [options]\n"
                      << "Options:\n"
                      << "  --trips <file>      Path to trips.json (default: data/trips.json)\n"
                      << "  --stations <file>   Path to stations.json (default: data/stations.json)\n"
                      << "  --out <dir>         Output directory (default: web/public/data)\n";
            return 0;
        }
    }

    std::cout << "========================================\n";
    std::cout << "  TripTracker SSG C++ Engine Starting   \n";
    std::cout << "========================================\n";
    std::cout << "[INFO] Loading stations from: " << stations_path << "\n";
    std::cout << "[INFO] Loading trips from:    " << trips_path << "\n";
    std::cout << "[INFO] Output directory:      " << out_dir << "\n";

    try {
        // 1. Read and parse stations
        std::string stations_raw = read_file_to_string(stations_path);
        nlohmann::json stations_json = mini_json::Parser::parse(stations_raw);

        std::map<std::string, Station> stations_map;
        for (const auto& [code, sval] : stations_json.obj_val_) {
            stations_map[code] = Station::from_json(code, sval);
        }
        std::cout << "[INFO] Parsed " << stations_map.size() << " station definitions.\n";

        // 2. Read and parse trips
        std::string trips_raw = read_file_to_string(trips_path);
        nlohmann::json trips_json = mini_json::Parser::parse(trips_raw);

        std::vector<Trip> trips_list;
        for (size_t i = 0; i < trips_json.size(); ++i) {
            trips_list.push_back(Trip::from_json(trips_json[i]));
        }
        std::cout << "[INFO] Parsed " << trips_list.size() << " trip records.\n";

        // 3. Process analytics
        StatsCollector collector;
        collector.process(trips_list, stations_map);

        // 4. Ensure output directory exists
        fs::create_directories(out_dir);

        // 5. Write stats.json
        std::string stats_file = out_dir + "/stats.json";
        nlohmann::json stats_out = collector.to_stats_json();
        write_string_to_file(stats_file, stats_out.dump(2));
        std::cout << "[SUCCESS] Exported: " << stats_file << "\n";

        // 6. Write routes.geojson
        std::string routes_file = out_dir + "/routes.geojson";
        nlohmann::json routes_out = collector.to_routes_geojson();
        write_string_to_file(routes_file, routes_out.dump(2));
        std::cout << "[SUCCESS] Exported: " << routes_file << "\n";

        // 7. Write stations.geojson
        std::string stations_file = out_dir + "/stations.geojson";
        nlohmann::json stations_out = collector.to_stations_geojson();
        write_string_to_file(stations_file, stations_out.dump(2));
        std::cout << "[SUCCESS] Exported: " << stations_file << "\n";

        std::cout << "========================================\n";
        std::cout << "  TripTracker Data Generation Completed \n";
        std::cout << "========================================\n";

    } catch (const std::exception& e) {
        std::cerr << "[ERROR] Engine failed: " << e.what() << "\n";
        return 1;
    }

    return 0;
}

