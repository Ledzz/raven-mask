#include <Arduino.h>
#include <FastLED.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// FastLED settings
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB

// BLE settings
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"


#define NUM_STRIPS 9
#define NUM_LEDS_PER_STRIP 11

CRGB leds[NUM_STRIPS][NUM_LEDS_PER_STRIP];
bool deviceConnected = false;
bool breathingMode = false;
BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string value = pCharacteristic->getValue();
      if (value.length() > 0) {
        String command = String(value.c_str());

        if (command.startsWith("COLOR:")) {
          // Handle color command (hex format)
          String hexColor = command.substring(6);
          breathingMode = false;
          long number = strtol(hexColor.c_str(), NULL, 16);
          fill_solid(leds[0], NUM_LEDS_PER_STRIP, CRGB(number >> 16, (number >> 8) & 0xFF, number & 0xFF));
        }
        else if (command == "ON") {
          breathingMode = false;
          fill_solid(leds[0], NUM_LEDS_PER_STRIP, CRGB::White);
        }
        else if (command == "OFF") {
          breathingMode = false;
          fill_solid(leds[0], NUM_LEDS_PER_STRIP, CRGB::Black);
        }
        else if (command == "BREATH") {
          breathingMode = true;
        }

        FastLED.show();
      }
    }
};

void setup() {
  Serial.begin(115200);

  // C++ template needs to have value at compile time so we can't use loop
  FastLED.addLeds<WS2812B, 1, GRB>(leds[0], NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812B, 2, GRB>(leds[1], NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812B, 3, GRB>(leds[2], NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812B, 4, GRB>(leds[3], NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812B, 5, GRB>(leds[4], NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812B, 6, GRB>(leds[5], NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812B, 7, GRB>(leds[6], NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812B, 8, GRB>(leds[7], NUM_LEDS_PER_STRIP);
  FastLED.addLeds<WS2812B, 9, GRB>(leds[8], NUM_LEDS_PER_STRIP);

  // Initialize BLE
  BLEDevice::init("ESP32 LED Control");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE
  );

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

void loop() {
  //float breath = (exp(sin(millis()/2000.0*PI)) - 0.36787944)*108.0;
  for (int i = 0; i < NUM_STRIPS; i++) {
    int value = (i == 3 || i == 7) ? 255 : 20;
    int color = (i == 3 || i == 7) ? 0 : 160;
    for (int k = 0; k < NUM_LEDS_PER_STRIP; k++) {
      leds[i][k] = CHSV(color, 255, value);
    }
  }

  FastLED.show();
  delay(10);
}