cmake_minimum_required(VERSION 3.15)

# Allow older CMake minimum versions in dependencies (SentencePiece uses 3.1)
set(CMAKE_POLICY_VERSION_MINIMUM 3.5 CACHE STRING "" FORCE)

project(mlx-tokenizer)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# ==============================================================================
# Fetch SentencePiece
# Reference: https://github.com/google/sentencepiece
# ==============================================================================

include(FetchContent)

set(SPM_VERSION "0.2.0")

message(STATUS "")
message(STATUS "=== Fetching SentencePiece v${SPM_VERSION} ===")
message(STATUS "")

# Disable SentencePiece components we don't need
set(SPM_ENABLE_SHARED OFF CACHE BOOL "" FORCE)
set(SPM_ENABLE_TCMALLOC OFF CACHE BOOL "" FORCE)
set(SPM_ENABLE_NFKC_COMPILE OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
  sentencepiece
  GIT_REPOSITORY https://github.com/google/sentencepiece.git
  GIT_TAG v${SPM_VERSION}
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(sentencepiece)

# ==============================================================================
# Node.js Addon
# ==============================================================================

# Find Node.js headers
execute_process(
  COMMAND node -p "require('node-addon-api').include"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  OUTPUT_VARIABLE NODE_ADDON_API_DIR
  OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})

# Include directories
include_directories(
  ${CMAKE_JS_INC}
  ${NODE_ADDON_API_DIR}
  ${sentencepiece_SOURCE_DIR}/src
)

# Build the addon
add_library(${PROJECT_NAME} SHARED
  src/binding.cpp
)

# Link against SentencePiece
target_link_libraries(${PROJECT_NAME}
  sentencepiece-static
)

# Node.js addon settings
set_target_properties(${PROJECT_NAME} PROPERTIES
  PREFIX ""
  SUFFIX ".node"
  LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/Release"
)

# Suppress Node.js undefined symbols (they're resolved at runtime)
if(APPLE)
  set_target_properties(${PROJECT_NAME} PROPERTIES
    LINK_FLAGS "-undefined dynamic_lookup"
  )
endif()

message(STATUS "")
message(STATUS "=== SentencePiece Tokenizer Configuration ===")
message(STATUS "SentencePiece Version: v${SPM_VERSION}")
message(STATUS "Node API: ${NODE_ADDON_API_DIR}")
message(STATUS "Output: ${PROJECT_NAME}.node")
message(STATUS "")
