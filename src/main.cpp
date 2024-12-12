#include <Arduino.h>
#include <FastLED.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <map>

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
    EYES,
    RANDOM
};

bool deviceConnected = false;
bool oldDeviceConnected = false;
MODE mode = SIMPLE;
BLEServer *pServer = NULL;
BLECharacteristic *pCharacteristic = NULL;

struct Config {
    MODE mode = SIMPLE;
    CRGB leds[NUM_STRIPS][MAX_NUM_LEDS_PER_STRIP];
} currentConfig;

class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer *pServer) {
        deviceConnected = true;
    };

    void onDisconnect(BLEServer *pServer) {
        deviceConnected = false;
    }
};


void setStripColor(int stripIndex, CRGB color) {
    CRGB stripColor = color;
    if (stripIndex != LEFT_EYE && stripIndex != RIGHT_EYE) {
        stripColor.nscale8(25);
    }
    for (int k = 0; k < LED_COUNTS[stripIndex]; k++) {
        currentConfig.leds[stripIndex][k] = stripColor;
    }
}

String rgbToCompactHex(CRGB color) {
    char hex[7];
    sprintf(hex, "%02x%02x%02x", color.r, color.g, color.b);
    return String(hex);
}

String getConfigJson() {
    StaticJsonDocument<600> doc;

    // Add current mode
    switch (currentConfig.mode) {
        case SIMPLE: doc["mode"] = "SIMPLE";
            break;
        case EYES: doc["mode"] = "EYES";
            break;
        case RANDOM: doc["mode"] = "RANDOM";
            break;
    }

    // Add colors for each strip and LED
    JsonArray stripsArray = doc.createNestedArray("strips");
    for(int i = 0; i < NUM_STRIPS; i++) {
        JsonArray ledsArray = stripsArray.createNestedArray();
        for(int j = 0; j < LED_COUNTS[i]; j++) {
            ledsArray.add(rgbToCompactHex(currentConfig.leds[i][j]));
        }
    }

    String jsonString;
    serializeJson(doc, jsonString);
    return jsonString;
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
            } else if (command.startsWith("COLOR:")) {
                String hexColor = command.substring(6);
                long number = strtol(hexColor.c_str(), NULL, 16);
                CRGB color = CRGB(number >> 16, (number >> 8) & 0xFF, number & 0xFF);

                for (int i = 0; i < NUM_STRIPS; i++) {
                    setStripColor(i, color);
                }
            } else if (command.startsWith("SCOLOR:")) {
                int stripIndex = command.substring(7, 8).toInt();
                String hexColor = command.substring(9);
                long number = strtol(hexColor.c_str(), NULL, 16);
                CRGB color = CRGB(number >> 16, (number >> 8) & 0xFF, number & 0xFF);
                setStripColor(stripIndex, color);
            } else if (command.startsWith("MODE:")) {
                String modeStr = command.substring(5);
                if (modeStr == "SIMPLE") {
                    mode = SIMPLE;
                } else if (modeStr == "EYES") {
                    mode = EYES;
                } else if (modeStr == "RANDOM") {
                    mode = RANDOM;
                }
            }
            FastLED.show();
        }
    }
};

void solid() {
    for (int i = 0; i < NUM_STRIPS; i++) {
        int value = (i == LEFT_EYE || i == RIGHT_EYE) ? 255 : 20;
        int color = (i == LEFT_EYE || i == RIGHT_EYE) ? 0 : 160;
        for (int k = 0; k < LED_COUNTS[i]; k++) {
            currentConfig.leds[i][k] = CHSV(color, 255, value);
        }
    }
}


void setup() {
    Serial.begin(115200);

    // C++ template needs to have value at compile time so we can't use loop
    FastLED.addLeds<WS2812B, 1, GRB>(currentConfig.leds[0], LED_COUNTS[0]);
    FastLED.addLeds<WS2812B, 2, GRB>(currentConfig.leds[1], LED_COUNTS[1]);
    FastLED.addLeds<WS2812B, 3, GRB>(currentConfig.leds[2], LED_COUNTS[2]);
    FastLED.addLeds<WS2812B, 4, GRB>(currentConfig.leds[3], LED_COUNTS[3]);
    FastLED.addLeds<WS2812B, 5, GRB>(currentConfig.leds[4], LED_COUNTS[4]);
    FastLED.addLeds<WS2812B, 6, GRB>(currentConfig.leds[5], LED_COUNTS[5]);
    FastLED.addLeds<WS2812B, 7, GRB>(currentConfig.leds[6], LED_COUNTS[6]);
    FastLED.addLeds<WS2812B, 8, GRB>(currentConfig.leds[7], LED_COUNTS[7]);
    FastLED.addLeds<WS2812B, 9, GRB>(currentConfig.leds[8], LED_COUNTS[8]);

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

    pCharacteristic->addDescriptor(new BLE2902());  // Required for notifications
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

    solid();
}


void updateEyes() {
    int LED_PER_EYE = 5;
    int step = (millis() / 100) % LED_PER_EYE;
    for (int k = 0; k < LED_PER_EYE; k++) {
        currentConfig.leds[RIGHT_EYE][k] = CRGB::Black;
        currentConfig.leds[LEFT_EYE][k] = CRGB::Black;
    }
    currentConfig.leds[RIGHT_EYE][step] = CRGB::White;
    currentConfig.leds[LEFT_EYE][step] = CRGB::White;
}

void updateRandom() {
    for (int i = 0; i < NUM_STRIPS; i++) {
        for (int k = 0; k < LED_COUNTS[i]; k++) {
            currentConfig.leds[i][k] = CHSV(random(255), 155 + random(100), random(255));
        }
    }
}

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

    if (mode == EYES) {
        updateEyes();
    } else if (mode == RANDOM) {
        updateRandom();
    }

    FastLED.show();
    delay(10);
}
