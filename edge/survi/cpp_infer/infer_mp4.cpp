// ~/ArduinoApps/survillance/cpp_infer/infer_mp4.cpp
// Full updated file: FIT_SHORTEST + center crop + BGR->RGB (matches model_metadata.h)

#include <opencv2/opencv.hpp>

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

// Edge Impulse
#include "../ei/edge-impulse-sdk/classifier/ei_run_classifier.h"
#include "../ei/model-parameters/model_metadata.h"
#include "../ei/model-parameters/model_variables.h"

// -------------------------
// Small helpers
// -------------------------
static bool write_file(const std::string &path, const std::string &body) {
    std::ofstream f(path, std::ios::binary);
    if (!f.is_open()) return false;
    f.write(body.data(), (std::streamsize)body.size());
    return true;
}

static std::string json_escape(const std::string &s) {
    std::ostringstream o;
    for (char c : s) {
        switch (c) {
            case '\\': o << "\\\\"; break;
            case '"':  o << "\\\""; break;
            case '\b': o << "\\b";  break;
            case '\f': o << "\\f";  break;
            case '\n': o << "\\n";  break;
            case '\r': o << "\\r";  break;
            case '\t': o << "\\t";  break;
            default:
                if ((unsigned char)c < 0x20) {
                    o << "\\u" << std::hex << std::uppercase << (int)c;
                } else {
                    o << c;
                }
        }
    }
    return o.str();
}

static bool starts_with(const std::string &s, const std::string &p) {
    return s.size() >= p.size() && s.compare(0, p.size(), p) == 0;
}

static cv::Mat resize_fit_shortest_center_crop_rgb(const cv::Mat& bgr, int W, int H) {
    // Matches EI_CLASSIFIER_RESIZE_FIT_SHORTEST:
    // 1) aspect-preserving resize so both dims >= target
    // 2) center crop to WxH
    // 3) BGR -> RGB
    const int src_w = bgr.cols;
    const int src_h = bgr.rows;

    const float scale = std::max((float)W / (float)src_w, (float)H / (float)src_h);
    const int new_w = (int)std::round(src_w * scale);
    const int new_h = (int)std::round(src_h * scale);

    cv::Mat resized;
    cv::resize(bgr, resized, cv::Size(new_w, new_h), 0, 0, cv::INTER_AREA);

    const int x0 = std::max(0, (new_w - W) / 2);
    const int y0 = std::max(0, (new_h - H) / 2);
    cv::Rect roi(x0, y0, W, H);
    cv::Mat cropped = resized(roi).clone();

    cv::Mat rgb;
    cv::cvtColor(cropped, rgb, cv::COLOR_BGR2RGB);
    return rgb;
}

static void usage(const char *argv0) {
    std::cerr
        << "Usage:\n"
        << "  " << argv0 << " --event_id <id> --mp4 <path> --out <path> [--frames N] [--threshold T]\n"
        << "\n"
        << "Example:\n"
        << "  " << argv0 << " --event_id 1772321990476 --mp4 clip.mp4 --out out.json --frames 8 --threshold 0.2\n";
}

// -------------------------
// Main
// -------------------------
int main(int argc, char **argv) {
    std::string event_id;
    std::string mp4_path;
    std::string out_path;
    int frames = 5;
    float threshold = 0.50f;

    for (int i = 1; i < argc; i++) {
        std::string a = argv[i];
        auto need = [&](const char *flag) {
            if (i + 1 >= argc) {
                std::cerr << "Missing value for " << flag << "\n";
                usage(argv[0]);
                std::exit(2);
            }
        };

        if (a == "--event_id") { need("--event_id"); event_id = argv[++i]; }
        else if (a == "--mp4") { need("--mp4"); mp4_path = argv[++i]; }
        else if (a == "--out") { need("--out"); out_path = argv[++i]; }
        else if (a == "--frames") { need("--frames"); frames = std::max(1, std::atoi(argv[++i])); }
        else if (a == "--threshold") { need("--threshold"); threshold = std::stof(argv[++i]); }
        else if (a == "--help" || a == "-h") { usage(argv[0]); return 0; }
        else {
            std::cerr << "Unknown arg: " << a << "\n";
            usage(argv[0]);
            return 2;
        }
    }

    if (event_id.empty() || mp4_path.empty() || out_path.empty()) {
        usage(argv[0]);
        return 2;
    }

    auto t0 = std::chrono::steady_clock::now();

    cv::VideoCapture cap(mp4_path);
    if (!cap.isOpened()) {
        std::string body = "{\n"
            "  \"event_id\": \"" + json_escape(event_id) + "\",\n"
            "  \"model\": \"edgeimpulse_fomo_local\",\n"
            "  \"status\": \"error\",\n"
            "  \"error\": \"failed to open mp4\"\n"
            "}\n";
        write_file(out_path, body);
        return 1;
    }

    int total_frames = (int)cap.get(cv::CAP_PROP_FRAME_COUNT);
    if (total_frames <= 0) total_frames = 1;

    // Choose frame indices (evenly spaced)
    std::vector<int> idxs;
    idxs.reserve(frames);
    if (frames == 1) {
        idxs.push_back(total_frames / 2);
    } else {
        for (int k = 0; k < frames; k++) {
            int fi = (int)std::round((double)k * (double)(total_frames - 1) / (double)(frames - 1));
            fi = std::max(0, std::min(total_frames - 1, fi));
            idxs.push_back(fi);
        }
    }

    // Aggregate results
    int people = 0;
    int cars = 0;
    int analyzed = 0;

    struct Det {
        std::string label;
        float conf;
        uint32_t x, y, w, h;
        int frame_idx;
    };
    std::vector<Det> dets;
    dets.reserve(64);

    // EI expects 160x160 and resize mode FIT_SHORTEST
    const int W = EI_CLASSIFIER_INPUT_WIDTH;   // 160
    const int H = EI_CLASSIFIER_INPUT_HEIGHT;  // 160
    const int C = 3;

    std::vector<uint8_t> rgb_u8(W * H * C);

    for (int fi : idxs) {
        cap.set(cv::CAP_PROP_POS_FRAMES, fi);

        cv::Mat frame;
        if (!cap.read(frame) || frame.empty()) continue;

        // ✅ Correct preprocessing: FIT_SHORTEST + center crop + RGB
        cv::Mat rgb = resize_fit_shortest_center_crop_rgb(frame, W, H);

        // Copy to contiguous buffer
        if (!rgb.isContinuous()) rgb = rgb.clone();
        std::memcpy(rgb_u8.data(), rgb.data, rgb_u8.size());

        // Prepare EI signal (float samples 0..255 are OK for EI image pipeline)
        signal_t signal;
        signal.total_length = rgb_u8.size();
        signal.get_data = [&](size_t offset, size_t length, float *out_ptr) -> int {
            if (offset + length > rgb_u8.size()) return -1;
            for (size_t i = 0; i < length; i++) {
                out_ptr[i] = (float)rgb_u8[offset + i];
            }
            return 0;
        };

        ei_impulse_result_t result = {0};
        EI_IMPULSE_ERROR r = run_classifier(&signal, &result, false);
        if (r != EI_IMPULSE_OK) {
            std::string err = "run_classifier failed: " + std::to_string((int)r);
            std::string body = "{\n"
                "  \"event_id\": \"" + json_escape(event_id) + "\",\n"
                "  \"model\": \"edgeimpulse_fomo_local\",\n"
                "  \"status\": \"error\",\n"
                "  \"error\": \"" + json_escape(err) + "\"\n"
                "}\n";
            write_file(out_path, body);
            return 1;
        }

        // Debug: is the model producing any boxes?
        std::cerr << "DEBUG bounding_boxes_count=" << result.bounding_boxes_count << "\n";

        analyzed++;

        // Collect bounding boxes (FOMO outputs bounding_boxes)
        for (uint32_t i = 0; i < result.bounding_boxes_count; i++) {
            auto &bb = result.bounding_boxes[i];
            if (!bb.label) continue;
            if (bb.value < threshold) continue;

            std::string lbl(bb.label);
            if (lbl == "person") people++;
            if (lbl == "car") cars++;

            dets.push_back(Det{
                lbl,
                bb.value,
                bb.x, bb.y, bb.width, bb.height,
                fi
            });
        }
    }

    cap.release();

    // Keep output small: top 25 by confidence
    std::sort(dets.begin(), dets.end(), [](const Det& a, const Det& b) {
        return a.conf > b.conf;
    });
    if (dets.size() > 25) dets.resize(25);

    auto t1 = std::chrono::steady_clock::now();
    int latency_ms = (int)std::chrono::duration_cast<std::chrono::milliseconds>(t1 - t0).count();

    // Write JSON
    std::string body;
    body.reserve(4096);
    body += "{\n";
    body += "  \"event_id\": \"" + json_escape(event_id) + "\",\n";
    body += "  \"model\": \"edgeimpulse_fomo_local\",\n";
    body += "  \"frames_analyzed\": " + std::to_string(analyzed) + ",\n";
    body += "  \"threshold\": " + std::to_string(threshold) + ",\n";
    body += "  \"summary\": {\"people\": " + std::to_string(people) + ", \"cars\": " + std::to_string(cars) + "},\n";
    body += "  \"detections\": [\n";
    for (size_t i = 0; i < dets.size(); i++) {
        const auto &d = dets[i];
        body += "    {\"label\":\"" + json_escape(d.label) + "\",\"conf\":" + std::to_string(d.conf) +
                ",\"bbox\":[" + std::to_string(d.x) + "," + std::to_string(d.y) + "," +
                               std::to_string(d.w) + "," + std::to_string(d.h) + "]," +
                "\"frame_idx\":" + std::to_string(d.frame_idx) + "}";
        body += (i + 1 == dets.size()) ? "\n" : ",\n";
    }
    body += "  ],\n";
    body += "  \"latency_ms\": " + std::to_string(latency_ms) + ",\n";
    body += "  \"status\": \"ok\"\n";
    body += "}\n";

    if (!write_file(out_path, body)) {
        std::fprintf(stderr, "Failed to write %s\n", out_path.c_str());
        return 1;
    }

    return 0;
}
