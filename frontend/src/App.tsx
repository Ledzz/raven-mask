import "./App.css";
import { useCallback, useEffect, useRef } from "react";
import { HexColorPicker } from "react-colorful";
import { ZONES } from "./zones.ts";
import { Zoned } from "./Zoned.tsx";

let characteristic: BluetoothRemoteGATTCharacteristic | undefined;
const serviceUuid = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const characteristicUuid = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const log = console.log;

const MODES = ["SIMPLE", "EYES", "RANDOM"];

function App() {
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
    if (characteristic) {
      const encoder = new TextEncoder();
      await characteristic.writeValue(encoder.encode(command));
    }
  }, []);

  const setColor = useCallback(
    (color: string) => {
      return sendCommand("COLOR:" + color.substring(1));
    },
    [sendCommand],
  );

  const setStripColor = useCallback(
    (strip: number, color: string) => {
      return sendCommand("SCOLOR:" + strip + ":" + color.substring(1));
    },
    [sendCommand],
  );

  const setMaskedColor = useCallback(
    (mask: number, color: string) => {
      return sendCommand(
        "MCOLOR:" + mask.toString().padStart(3, "0") + ":" + color.substring(1),
      );
    },
    [sendCommand],
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
        <Zoned setMaskedColor={setMaskedColor} />
      </section>
      <section>
        <h1>Все вместе</h1>
        <HexColorPicker onChange={(e) => setColor(e)} />
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

      {ZONES.map((zone) => (
        <section key={zone.id}>
          <h1>{zone.name}</h1>
          <HexColorPicker onChange={(e) => setStripColor(zone.id, e)} />
        </section>
      ))}
    </div>
  );
}

export default App;
