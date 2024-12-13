import "./App.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { ZONES } from "./zones.ts";
import { Zoned } from "./Zoned.tsx";

let characteristic: BluetoothRemoteGATTCharacteristic | undefined;
const serviceUuid = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const characteristicUuid = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const log = console.log;

const MODES = ["SIMPLE", "EYES", "RANDOM"];

interface Config {
  mode: string;
  strips: { color: string; mode: number; brightness: number }[];
}

function App() {
  const [currentConfig, setCurrentConfig] = useState<Config>({
    mode: "SIMPLE",
    strips: [],
  });
  const autoConnect = useCallback(async () => {
    try {
      log("Getting existing permitted Bluetooth devices...");
      const devices = await navigator.bluetooth.getDevices();

      log("> Got " + devices.length + " Bluetooth devices.");
      // These devices may not be powered on or in range, so scan for
      // advertisement packets from them before connecting.
      for (const device of devices) {
        connectToDevice(device);
      }
    } catch (error) {
      log("Argh! " + error);
    }
  }, []);

  const readConfiguration = useCallback(async () => {
    if (!characteristic) return;

    try {
      await characteristic.startNotifications();
      // Send command to request config
      await sendCommand("GET_CONFIG");

      // Set up notification listener for the response
      characteristic.addEventListener("characteristicvaluechanged", (event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (value) {
          const decoder = new TextDecoder();
          const configString = decoder.decode(value);
          try {
            const config = JSON.parse(configString);
            setCurrentConfig(config);
            log("Received configuration:", config);
          } catch (e) {
            log("Error parsing configuration:", e);
          }
        }
      });
    } catch (error) {
      log("Error reading configuration:", error);
    }
  }, []);

  const connectToDevice = useCallback(async (device: BluetoothDevice) => {
    const abortController = new AbortController();

    device.addEventListener(
      "advertisementreceived",
      async (event: BluetoothAdvertisingEvent) => {
        log('> Received advertisement from "' + device.name + '"...');
        // Stop watching advertisements to conserve battery life.
        abortController.abort();
        log('Connecting to GATT Server from "' + device.name + '"...');
        try {
          const server = await device.gatt?.connect();
          log('> Bluetooth device "' + device.name + " connected.");

          const service = await server?.getPrimaryService(serviceUuid);
          characteristic = await service?.getCharacteristic(characteristicUuid);
          document.getElementById("status").textContent = "Connected!";

          await readConfiguration();
        } catch (error) {
          log("Argh! " + error);
        }
      },
      { once: true },
    );

    try {
      log('Watching advertisements from "' + device.name + '"...');
      await device.watchAdvertisements({ signal: abortController.signal });
    } catch (error) {
      log("Argh! " + error);
    }
  }, []);

  const manualConnect = useCallback(async () => {
    try {
      log("Requesting any Bluetooth device...");
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          {
            services: [serviceUuid],
          },
        ],
      });

      log("> Requested " + device.name);
    } catch (error) {
      log("Argh! " + error);
    }
  }, []);

  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      autoConnect();
    }
    startedRef.current = true;
  }, [autoConnect]);

  const sendCommand = useCallback(async (command: string) => {
    console.log("Send Command:", command);
    if (characteristic) {
      const encoder = new TextEncoder();
      await characteristic.writeValue(encoder.encode(command));
    }
  }, []);

  const sendMaskCommand = useCallback(
    (bitmask: number, color: string, brightness: number, mode: string) => {
      // Convert color from hex (#RRGGBB) to numbers
      const r = parseInt(color.substr(1, 2), 16);
      const g = parseInt(color.substr(3, 2), 16);
      const b = parseInt(color.substr(5, 2), 16);

      // Format: MASK:bitmask:RRGGBB:brightness:mode
      const command = `MASK:${bitmask.toString().padStart(3, "0")}:${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}:${brightness}:${mode}`;

      return sendCommand(command);
    },
    [],
  );

  return (
    <div>
      <div id="status">Not Connected</div>
      <button className="button" onClick={manualConnect}>
        Connect
      </button>
      <br />
      <br />
      <section>
        <Zoned currentConfig={currentConfig} setMaskedColor={sendMaskCommand} />
      </section>
      <section>
        <h1>Все вместе</h1>
        <HexColorPicker onChange={noop} />
      </section>

      {MODES.map((mode) => (
        <button
          key={mode}
          className="button"
          onClick={() => sendCommand(`MODE:${mode}`)}
        >
          {mode}
        </button>
      ))}

      {ZONES.map((zone) => {
        return (
          <section key={zone.id}>
            <h1>{zone.name}</h1>
            <HexColorPicker
              color={currentConfig.strips?.[zone.id]?.color}
              onChange={noop}
            />
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={currentConfig.strips?.[zone.id]?.brightness}
            />
          </section>
        );
      })}
    </div>
  );
}
function noop() {}
export default App;
