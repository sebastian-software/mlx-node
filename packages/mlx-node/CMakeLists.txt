cmake_minimum_required(VERSION 3.20)
project(mlx-node)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================================
# Options
# ============================================================================

option(MLX_STUB_MODE "Build stub without MLX (for development)" OFF)

# ============================================================================
# Find Dependencies
# ============================================================================

if(NOT MLX_STUB_MODE)
    # Find MLX
    set(MLX_SEARCH_PATHS
        ${MLX_DIR}
        $ENV{MLX_DIR}
        /opt/homebrew/lib/cmake/mlx
        /usr/local/lib/cmake/mlx
        ${CMAKE_SOURCE_DIR}/deps/mlx
        ${CMAKE_SOURCE_DIR}/../mlx/build
    )

    find_package(MLX CONFIG QUIET PATHS ${MLX_SEARCH_PATHS})

    if(NOT MLX_FOUND)
        message(STATUS "MLX not found via find_package, trying pkg-config...")
        find_package(PkgConfig QUIET)
        if(PKG_CONFIG_FOUND)
            pkg_check_modules(MLX QUIET mlx)
        endif()
    endif()

    if(NOT MLX_FOUND)
        message(STATUS "")
        message(STATUS "⚠ MLX not found. Building in STUB MODE.")
        message(STATUS "  To build with MLX, either:")
        message(STATUS "    1. Install MLX: pip install mlx")
        message(STATUS "    2. Build MLX from source and set -DMLX_DIR=<path>")
        message(STATUS "    3. Set MLX_DIR environment variable")
        message(STATUS "")
        set(MLX_STUB_MODE ON)
    endif()
endif()

# Node.js / N-API
include_directories(${CMAKE_JS_INC})

# node-addon-api
execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
include_directories(${NODE_ADDON_API_DIR})

# ============================================================================
# Source Files
# ============================================================================

if(MLX_STUB_MODE)
    set(BINDING_SOURCES
        ${CMAKE_SOURCE_DIR}/src/native/stub.cpp
    )
else()
    set(BINDING_SOURCES
        ${CMAKE_SOURCE_DIR}/generated/binding.cpp
    )

    # Check if generated files exist
    if(NOT EXISTS "${CMAKE_SOURCE_DIR}/generated/binding.cpp")
        message(FATAL_ERROR "Generated bindings not found. Run 'pnpm generate' first.")
    endif()
endif()

# ============================================================================
# Native Module
# ============================================================================

add_library(${PROJECT_NAME} SHARED ${BINDING_SOURCES})

# Set output name and extension
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    OUTPUT_NAME "mlx_node"
)

# Link against cmake-js provided libraries
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})

# Link against MLX if found
if(NOT MLX_STUB_MODE AND MLX_FOUND)
    target_link_libraries(${PROJECT_NAME} mlx)
    target_compile_definitions(${PROJECT_NAME} PRIVATE MLX_AVAILABLE=1)
else()
    target_compile_definitions(${PROJECT_NAME} PRIVATE MLX_AVAILABLE=0)
endif()

# N-API version
target_compile_definitions(${PROJECT_NAME} PRIVATE
    NAPI_VERSION=8
    NAPI_CPP_EXCEPTIONS
)

# macOS specific settings
if(APPLE)
    set_target_properties(${PROJECT_NAME} PROPERTIES
        MACOSX_RPATH ON
        BUILD_WITH_INSTALL_RPATH TRUE
    )

    if(NOT MLX_STUB_MODE)
        # For Metal support
        find_library(METAL_FRAMEWORK Metal)
        find_library(FOUNDATION_FRAMEWORK Foundation)
        if(METAL_FRAMEWORK AND FOUNDATION_FRAMEWORK)
            target_link_libraries(${PROJECT_NAME}
                ${METAL_FRAMEWORK}
                ${FOUNDATION_FRAMEWORK}
            )
        endif()
    endif()
endif()

# ============================================================================
# Info
# ============================================================================

message(STATUS "")
message(STATUS "=== MLX Node.js Configuration ===")
if(MLX_STUB_MODE)
    message(STATUS "Mode: STUB (MLX not available)")
else()
    message(STATUS "Mode: FULL (with MLX)")
endif()
message(STATUS "Node Addon API: ${NODE_ADDON_API_DIR}")
message(STATUS "Output: ${CMAKE_LIBRARY_OUTPUT_DIRECTORY}/mlx_node.node")
message(STATUS "")
