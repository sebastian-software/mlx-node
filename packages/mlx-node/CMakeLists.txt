cmake_minimum_required(VERSION 3.20)
project(mlx-node)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ============================================================================
# MLX Version Configuration
# ============================================================================

# Pinned MLX version - update this when upgrading
# Check for updates: pnpm --filter @mlx-node/codegen check:mlx-version
set(MLX_GIT_TAG "v0.30.3")
set(MLX_REPOSITORY "https://github.com/ml-explore/mlx.git")

# ============================================================================
# MLX Dependency (via FetchContent)
# ============================================================================

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

set(BINDING_SOURCES ${CMAKE_SOURCE_DIR}/generated/binding.cpp)

if(NOT EXISTS "${CMAKE_SOURCE_DIR}/generated/binding.cpp")
    message(FATAL_ERROR "Generated bindings not found. Run 'pnpm generate' first.")
endif()

# ============================================================================
# Native Module
# ============================================================================

add_library(${PROJECT_NAME} SHARED ${BINDING_SOURCES})

set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    SUFFIX ".node"
    OUTPUT_NAME "mlx_node"
)

target_link_libraries(${PROJECT_NAME} PRIVATE ${CMAKE_JS_LIB} mlx)
target_include_directories(${PROJECT_NAME} PRIVATE ${mlx_SOURCE_DIR})

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

# ============================================================================
# Build Info
# ============================================================================

message(STATUS "")
message(STATUS "=== MLX Node.js Configuration ===")
message(STATUS "MLX Version: ${MLX_GIT_TAG}")
message(STATUS "Node API:    ${NODE_ADDON_API_DIR}")
message(STATUS "Output:      mlx_node.node")
message(STATUS "")
