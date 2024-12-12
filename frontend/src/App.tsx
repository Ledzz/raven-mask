import "./App.css";
import { useCallback, useEffect, useRef } from "react";
import { HexColorPicker } from "react-colorful";

let characteristic: BluetoothRemoteGATTCharacteristic | undefined;
const serviceUuid = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const characteristicUuid = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const log = console.log;

const MODES = ["SIMPLE", "EYES", "RANDOM"];

const ZONES = [
  {
    id: 0,
    name: "висок верх",
  },
  {
    id: 1,
    name: "брови",
  },
  {
    id: 2,
    name: "лоб",
  },
  {
    id: 3,
    name: "левый глаз",
  },
  {
    id: 4,
    name: "подбородок",
  },
  {
    id: 5,
    name: "клюв",
  },
  {
    id: 6,
    name: "щека",
  },
  {
    id: 7,
    name: "правый глаз",
  },
  {
    id: 8,
    name: "висок",
  },
];

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

  const setColor = useCallback(async (color: string) => {
    if (characteristic) {
      const command = "COLOR:" + color.substring(1);
      const encoder = new TextEncoder();
      await characteristic.writeValue(encoder.encode(command));
    }
  }, []);

  const setStripColor = useCallback(async (strip: number, color: string) => {
    const command = "SCOLOR:" + strip + ":" + color.substring(1);

    if (characteristic) {
      const encoder = new TextEncoder();
      await characteristic.writeValue(encoder.encode(command));
    }
  }, []);

  return (
    <div>
      <div id="status">Not Connected</div>
      <button className="button" onClick={manualConnect}>
        Connect
      </button>
      <br />
      <br />
      <section>
        <h1>Все вместе</h1>
        <HexColorPicker onChange={(e) => setColor(e)} />
      </section>

      <br />
      <br />

      {MODES.map((mode) => {
        return (
          <button
            key={mode}
            className="button"
            onClick={() => sendCommand(`MODE:${mode}`)}
          >
            {mode}
          </button>
        );
      })}

      {ZONES.map((zone) => {
        return (
          <section key={zone.id}>
            <h1>{zone.name}</h1>
            <HexColorPicker onChange={(e) => setStripColor(zone.id, e)} />
          </section>
        );
      })}
    </div>
  );
}

export default App;
