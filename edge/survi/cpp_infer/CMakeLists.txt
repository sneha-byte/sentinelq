cmake_minimum_required(VERSION 3.16)
project(ei_infer_mp4 C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(EI_DIR ${CMAKE_SOURCE_DIR}/../ei)

find_package(OpenCV REQUIRED)

# --- Edge Impulse: model sources ---
file(GLOB EI_MODEL_SRC
    "${EI_DIR}/tflite-model/*.cpp"
)

# --- Edge Impulse: SDK runtime sources we need on Linux/Posix ---
# Porting layer implements ei_malloc/ei_printf/timers/etc.
file(GLOB_RECURSE EI_PORTING_SRC
    "${EI_DIR}/edge-impulse-sdk/porting/posix/*.cpp"
    "${EI_DIR}/edge-impulse-sdk/porting/posix/*.c"
    "${EI_DIR}/edge-impulse-sdk/porting/*.cpp"
    "${EI_DIR}/edge-impulse-sdk/porting/*.c"
)

# Classifier + DSP code (feature extraction helpers, etc.)
file(GLOB_RECURSE EI_CLASSIFIER_SRC
    "${EI_DIR}/edge-impulse-sdk/classifier/*.cpp"
    "${EI_DIR}/edge-impulse-sdk/classifier/*.c"
    "${EI_DIR}/edge-impulse-sdk/classifier/**/*.cpp"
    "${EI_DIR}/edge-impulse-sdk/classifier/**/*.c"
    "${EI_DIR}/edge-impulse-sdk/dsp/*.cpp"
    "${EI_DIR}/edge-impulse-sdk/dsp/*.c"
    "${EI_DIR}/edge-impulse-sdk/dsp/**/*.cpp"
    "${EI_DIR}/edge-impulse-sdk/dsp/**/*.c"
)

# TensorFlow Lite Micro runtime + kernels used by the compiled model
file(GLOB_RECURSE EI_TFLM_SRC
    "${EI_DIR}/edge-impulse-sdk/tensorflow/lite/**/*.cc"
    "${EI_DIR}/edge-impulse-sdk/tensorflow/lite/**/*.c"
    "${EI_DIR}/edge-impulse-sdk/tensorflow/lite/**/*.cpp"
)

add_executable(ei_infer_mp4
    infer_mp4.cpp
    ${EI_MODEL_SRC}
    ${EI_PORTING_SRC}
    ${EI_CLASSIFIER_SRC}
    ${EI_TFLM_SRC}
)

target_include_directories(ei_infer_mp4 PRIVATE
    ${EI_DIR}
    ${EI_DIR}/edge-impulse-sdk
    ${EI_DIR}/model-parameters
)

# Good defaults for Linux builds
target_compile_definitions(ei_infer_mp4 PRIVATE
    EI_CLASSIFIER_ALLOCATION_STATIC=1
)

# --- Fix: Debian aarch64 needs explicit codec2 + kissfft for OpenCV video deps ---
set(CODEC2_LIB "/lib/aarch64-linux-gnu/libcodec2.so")
set(KISSFFT_LIB "/lib/aarch64-linux-gnu/libkissfft-float.so")

if(NOT EXISTS ${CODEC2_LIB})
    message(FATAL_ERROR "CODEC2_LIB not found at ${CODEC2_LIB}")
endif()
if(NOT EXISTS ${KISSFFT_LIB})
    message(FATAL_ERROR "KISSFFT_LIB not found at ${KISSFFT_LIB}")
endif()

target_link_libraries(ei_infer_mp4 PRIVATE
    ${OpenCV_LIBS}
    ${CODEC2_LIB}
    ${KISSFFT_LIB}
    pthread
    dl
    m
)
