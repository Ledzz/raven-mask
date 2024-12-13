#include <Arduino.h>
#include <FastLED.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <map>
#include <Preferences.h>
#include <noise.h>

Preferences preferences;


// FastLED settings
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB

// BLE settings
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

#define NUM_STRIPS 9
#define MAX_NUM_LEDS_PER_STRIP 11
std::map<int, int> LED_COUNTS = {
    {0, 1},
    {1, 4},
    {2, 4},
    {3, 5},
    {4, 7},
    {5, 11},
    {6, 2},
    {7, 5},
    {8, 3}
};


#define LEFT_EYE 3
#define RIGHT_EYE 7

enum MODE {
    SIMPLE,
    NOISE
};

bool deviceConnected = false;
bool oldDeviceConnected = false;
MODE mode = SIMPLE;
BLEServer *pServer = NULL;
BLECharacteristic *pCharacteristic = NULL;

unsigned long lastSaveTime = 0;
const unsigned long SAVE_INTERVAL = 5000; // 5 seconds between saves
bool needsSave = false;

struct StripConfig {
    CRGB color;
    int brightness = 20;
    MODE mode = SIMPLE;

    StripConfig(CRGB c) : color(c) {
    }
};

struct Config {
    StripConfig strips[NUM_STRIPS];
} currentConfig = {
    {
        {CRGB::Red},
        {CRGB::Green},
        {CRGB::Blue},
        {CRGB::White},
        {CRGB::Yellow},
        {CRGB::Purple},
        {CRGB::Orange},
        {CRGB::Pink},
        {CRGB::Cyan}
    }
};

CRGB leds[NUM_STRIPS][MAX_NUM_LEDS_PER_STRIP];

void saveConfig() {
    unsigned long currentTime = millis();

    // Set flag that we need to save
    needsSave = true;

    // Check if enough time has passed since last save
    if (currentTime - lastSaveTime < SAVE_INTERVAL) {
        return; // Exit if not enough time has passed
    }

    // Reset flag and update last save time
    needsSave = false;
    lastSaveTime = currentTime;

    // Use try-catch to prevent crashes
    try {
        preferences.begin("ledmask", false);

        // Save each strip's configuration
        for (int i = 0; i < NUM_STRIPS; i++) {
            char keyColor[16];
            char keyBright[16];
            char keyMode[16];

            sprintf(keyColor, "color_%d", i);
            sprintf(keyBright, "bright_%d", i);
            sprintf(keyMode, "mode_%d", i);

            uint32_t color = (uint32_t) currentConfig.strips[i].color.r << 16 |
                             (uint32_t) currentConfig.strips[i].color.g << 8 |
                             (uint32_t) currentConfig.strips[i].color.b;

            preferences.putUInt(keyColor, color);
            preferences.putInt(keyBright, currentConfig.strips[i].brightness);
            preferences.putUChar(keyMode, (uint8_t) currentConfig.strips[i].mode);

            // Give some time to the system
            yield();
        }

        preferences.end();
        Serial.println("Config saved!");
    } catch (...) {
        Serial.println("Error saving config");
        preferences.end(); // Make sure we clean up
    }
}


void loadConfig() {
    preferences.begin("ledmask", true); // true = readonly

    // Load each strip's configuration
    for (int i = 0; i < NUM_STRIPS; i++) {
        char keyColor[16];
        char keyBright[16];
        char keyMode[16];

        sprintf(keyColor, "color_%d", i);
        sprintf(keyBright, "bright_%d", i);
        sprintf(keyMode, "mode_%d", i);

        // Get color as 32-bit integer (RGB)
        uint32_t color = preferences.getUInt(keyColor, 0); // default to black

        currentConfig.strips[i].color.r = (color >> 16) & 0xFF;
        currentConfig.strips[i].color.g = (color >> 8) & 0xFF;
        currentConfig.strips[i].color.b = color & 0xFF;

        currentConfig.strips[i].brightness = preferences.getInt(keyBright, 20); // default brightness
        currentConfig.strips[i].mode = (MODE) preferences.getUChar(keyMode, SIMPLE); // default mode
    }

    preferences.end();
    Serial.println("Config loaded!");
}

const float SPACE_SCALE = 0.2; // Controls how different nearby LEDs are
const float TIME_SCALE = 0.01; // Controls animation speed
void updateLeds() {
    for (int i = 0; i < NUM_STRIPS; i++) {
        if (currentConfig.strips[i].mode == SIMPLE) {
            for (int j = 0; j < LED_COUNTS[i]; j++) {
                leds[i][j] = currentConfig.strips[i].color % currentConfig.strips[i].brightness;
            }
        } else if (currentConfig.strips[i].mode == NOISE) {
            for (int j = 0; j < LED_COUNTS[i]; j++) {
                float noise = noise2D(
                    j * SPACE_SCALE, // Space coordinate (scaled position)
                    millis() * TIME_SCALE // Time coordinate (scaled time)
                );
                leds[i][j] = currentConfig.strips[i].color % (currentConfig.strips[i].brightness * noise);
            }
        }
    }
}

class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer *pServer) {
        deviceConnected = true;
    };

    void onDisconnect(BLEServer *pServer) {
        deviceConnected = false;
    }
};

String rgbToCompactHex(CRGB color) {
    char hex[7];
    sprintf(hex, "%02x%02x%02x", color.r, color.g, color.b);
    return String(hex);
}

String getConfigJson() {
    StaticJsonDocument<600> doc;

    // Add colors for each strip and LED
    JsonArray stripsArray = doc.createNestedArray("strips");
    for (int i = 0; i < NUM_STRIPS; i++) {
        JsonObject strip = stripsArray.createNestedObject();
        strip["color"] = rgbToCompactHex(currentConfig.strips[i].color);
        strip["brightness"] = currentConfig.strips[i].brightness;
        String modeStr;
        switch(currentConfig.strips[i].mode) {
            case SIMPLE: modeStr = "SIMPLE"; break;
            case NOISE: modeStr = "NOISE"; break;
            default: modeStr = "SIMPLE";
        }
        strip["mode"] = modeStr;    }

    String jsonString;
    serializeJson(doc, jsonString);
    return jsonString;
}

void handleMaskCommand(const String &command) {
    // Expected format: MASK:bitmask:RRGGBB:brightness:mode
    int firstColon = command.indexOf(':');
    int secondColon = command.indexOf(':', firstColon + 1);
    int thirdColon = command.indexOf(':', secondColon + 1);
    int fourthColon = command.indexOf(':', thirdColon + 1);

    if (firstColon == -1 || secondColon == -1 || thirdColon == -1 || fourthColon == -1) {
        Serial.println("Invalid command format");
        return;
    }

    // Parse bitmask (which strips to update)
    int bitmask = command.substring(firstColon + 1, secondColon).toInt();

    // Parse color
    String hexColor = command.substring(secondColon + 1, thirdColon);
    uint32_t colorNum = strtol(hexColor.c_str(), NULL, 16);
    CRGB color = CRGB(
        (colorNum >> 16) & 0xFF,
        (colorNum >> 8) & 0xFF,
        colorNum & 0xFF
    );

    // Parse brightness
    int brightness = command.substring(thirdColon + 1, fourthColon).toInt();

    // Parse mode
    String modeStr = command.substring(fourthColon + 1);
    MODE newMode = SIMPLE;
    if (modeStr == "NOISE") newMode = NOISE;

    // Update strips based on bitmask
    for (int i = 0; i < NUM_STRIPS; i++) {
        if (bitmask & (1 << i)) {
            currentConfig.strips[i].color = color;
            currentConfig.strips[i].brightness = brightness;
            currentConfig.strips[i].mode = newMode;
        }
    }

    needsSave = true;
}


class MyCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() > 0) {
            String command = String(value.c_str());
            Serial.println(command);
            if (command == "GET_CONFIG") {
                String config = getConfigJson();
                pCharacteristic->setValue(config.c_str());
                pCharacteristic->notify();
            } else if (command.startsWith("MASK:")) {
                handleMaskCommand(command);
            }
            FastLED.show();
        }
    }
};


void setup() {
    Serial.begin(115200);
    loadConfig();

    // C++ template needs to have value at compile time so we can't use loop
    FastLED.addLeds<WS2812B, 1, GRB>(leds[0], LED_COUNTS[0]);
    FastLED.addLeds<WS2812B, 2, GRB>(leds[1], LED_COUNTS[1]);
    FastLED.addLeds<WS2812B, 3, GRB>(leds[2], LED_COUNTS[2]);
    FastLED.addLeds<WS2812B, 4, GRB>(leds[3], LED_COUNTS[3]);
    FastLED.addLeds<WS2812B, 5, GRB>(leds[4], LED_COUNTS[4]);
    FastLED.addLeds<WS2812B, 6, GRB>(leds[5], LED_COUNTS[5]);
    FastLED.addLeds<WS2812B, 7, GRB>(leds[6], LED_COUNTS[6]);
    FastLED.addLeds<WS2812B, 8, GRB>(leds[7], LED_COUNTS[7]);
    FastLED.addLeds<WS2812B, 9, GRB>(leds[8], LED_COUNTS[8]);

    // Initialize BLE
    BLEDevice::init("Ledzz mask");
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    BLEService *pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_WRITE |
        BLECharacteristic::PROPERTY_NOTIFY
    );

    pCharacteristic->addDescriptor(new BLE2902()); // Required for notifications
    pCharacteristic->setCallbacks(new MyCallbacks());
    pService->start();

    // Start advertising
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.println("BLE LED Control Ready!");
}


// void updateEyes() {
//     int LED_PER_EYE = 5;
//     int step = (millis() / 100) % LED_PER_EYE;
//     for (int k = 0; k < LED_PER_EYE; k++) {
//         currentConfig.leds[RIGHT_EYE][k] = CRGB::Black;
//         currentConfig.leds[LEFT_EYE][k] = CRGB::Black;
//     }
//     currentConfig.leds[RIGHT_EYE][step] = CRGB::White;
//     currentConfig.leds[LEFT_EYE][step] = CRGB::White;
// }

// void updateRandom() {
// for (int i = 0; i < NUM_STRIPS; i++) {
// for (int k = 0; k < LED_COUNTS[i]; k++) {
// currentConfig.leds[i][k] = CHSV(random(255), 155 + random(100), random(255));
// }
// }
// }

void loop() {
    if (!deviceConnected && oldDeviceConnected) {
        delay(500); // Give the bluetooth stack time to get ready
        pServer->startAdvertising(); // Restart advertising
        oldDeviceConnected = deviceConnected;
    }

    // Connection established
    if (deviceConnected && !oldDeviceConnected) {
        oldDeviceConnected = deviceConnected;
    }

    // Check if we need to save and enough time has passed
    if (needsSave && (millis() - lastSaveTime >= SAVE_INTERVAL)) {
        saveConfig();
    }
    updateLeds();
    FastLED.show();
    delay(10);
}
