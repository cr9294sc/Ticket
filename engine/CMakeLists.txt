cmake_minimum_required(VERSION 3.16)
project(TripTrackerEngine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Optimization flags
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -O2)
endif()

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

# Executable target
add_executable(trip_engine
    src/main.cpp
    src/geo_calc.cpp
    src/stats_collector.cpp
)

# Set output directory to root build/bin or build/
set_target_properties(trip_engine PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}"
)

