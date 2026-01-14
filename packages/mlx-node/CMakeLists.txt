cmake_minimum_required(VERSION 3.20)
project(mlx-node)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================================
# MLX Version Configuration
# ============================================================================

# Pinned MLX version - update this when upgrading
# Check for updates: pnpm check:mlx-version
# Note: Use MLX_GIT_TAG (not MLX_VERSION) to avoid conflict with MLX's own CMake variable
set(MLX_GIT_TAG "v0.30.3")
set(MLX_REPOSITORY "https://github.com/ml-explore/mlx.git")

# ============================================================================
# Options
# ============================================================================

option(MLX_STUB_MODE "Build stub without MLX (for development/CI)" OFF)
option(MLX_FETCH "Fetch MLX via FetchContent (recommended)" ON)

# ============================================================================
# MLX Dependency
# ============================================================================

if(NOT MLX_STUB_MODE)
    if(MLX_FETCH)
        # Use FetchContent to download and build MLX
        include(FetchContent)

        message(STATUS "")
        message(STATUS "=== Fetching MLX ${MLX_GIT_TAG} ===")
        message(STATUS "Repository: ${MLX_REPOSITORY}")
        message(STATUS "This may take a few minutes on first build...")
        message(STATUS "")

        FetchContent_Declare(
            mlx
            GIT_REPOSITORY ${MLX_REPOSITORY}
            GIT_TAG        ${MLX_GIT_TAG}
            GIT_SHALLOW    TRUE
            GIT_PROGRESS   TRUE
        )

        # MLX build options
        set(MLX_BUILD_TESTS OFF CACHE BOOL "" FORCE)
        set(MLX_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
        set(MLX_BUILD_BENCHMARKS OFF CACHE BOOL "" FORCE)
        set(MLX_BUILD_PYTHON_BINDINGS OFF CACHE BOOL "" FORCE)
        set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

        FetchContent_MakeAvailable(mlx)

        set(MLX_FOUND TRUE)
    else()
        # Try to find system-installed MLX
        set(MLX_SEARCH_PATHS
            ${MLX_DIR}
            $ENV{MLX_DIR}
            /opt/homebrew/lib/cmake/mlx
            /usr/local/lib/cmake/mlx
        )

        find_package(MLX CONFIG QUIET PATHS ${MLX_SEARCH_PATHS})

        if(NOT MLX_FOUND)
            message(STATUS "")
            message(STATUS "MLX not found. Options:")
            message(STATUS "  1. Use -DMLX_FETCH=ON (recommended)")
            message(STATUS "  2. Set -DMLX_DIR=<path>")
            message(STATUS "  3. Use -DMLX_STUB_MODE=ON for development")
            message(STATUS "")
            message(STATUS "Building in STUB MODE.")
            set(MLX_STUB_MODE ON)
        endif()
    endif()
endif()

# ============================================================================
# Node.js / N-API
# ============================================================================

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
target_link_libraries(${PROJECT_NAME} PRIVATE ${CMAKE_JS_LIB})

# Link against MLX
if(NOT MLX_STUB_MODE AND MLX_FOUND)
    target_link_libraries(${PROJECT_NAME} PRIVATE mlx)
    target_include_directories(${PROJECT_NAME} PRIVATE ${mlx_SOURCE_DIR})
    target_compile_definitions(${PROJECT_NAME} PRIVATE MLX_AVAILABLE=1)
else()
    target_compile_definitions(${PROJECT_NAME} PRIVATE MLX_AVAILABLE=0)
endif()

# N-API version
target_compile_definitions(${PROJECT_NAME} PRIVATE
    NAPI_VERSION=8
    NAPI_CPP_EXCEPTIONS
)

# ============================================================================
# macOS Settings
# ============================================================================

if(APPLE)
    set_target_properties(${PROJECT_NAME} PROPERTIES
        MACOSX_RPATH ON
        BUILD_WITH_INSTALL_RPATH TRUE
    )

    if(NOT MLX_STUB_MODE)
        # Metal framework for GPU support
        find_library(METAL_FRAMEWORK Metal)
        find_library(FOUNDATION_FRAMEWORK Foundation)
        find_library(ACCELERATE_FRAMEWORK Accelerate)

        if(METAL_FRAMEWORK AND FOUNDATION_FRAMEWORK)
            target_link_libraries(${PROJECT_NAME} PRIVATE
                ${METAL_FRAMEWORK}
                ${FOUNDATION_FRAMEWORK}
            )
        endif()

        if(ACCELERATE_FRAMEWORK)
            target_link_libraries(${PROJECT_NAME} PRIVATE ${ACCELERATE_FRAMEWORK})
        endif()
    endif()
endif()

# ============================================================================
# Build Info
# ============================================================================

message(STATUS "")
message(STATUS "=== MLX Node.js Configuration ===")
if(MLX_STUB_MODE)
    message(STATUS "Mode:        STUB (MLX not available)")
else()
    message(STATUS "Mode:        FULL (with MLX ${MLX_GIT_TAG})")
endif()
message(STATUS "Node API:    ${NODE_ADDON_API_DIR}")
message(STATUS "Output:      mlx_node.node")
message(STATUS "")
