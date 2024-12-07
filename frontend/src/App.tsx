import './App.css'
import {useCallback, useEffect} from "react";

let characteristic = null;
const serviceUuid = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const characteristicUuid = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const log = console.log;

function App() {
    const autoConnect = useCallback(async () => {
        try {
            log('Getting existing permitted Bluetooth devices...');
            const devices = await navigator.bluetooth.getDevices();

            log('> Got ' + devices.length + ' Bluetooth devices.');
            // These devices may not be powered on or in range, so scan for
            // advertisement packets from them before connecting.
            for (const device of devices) {
                connectToDevice(device);
            }
        } catch (error) {
            log('Argh! ' + error);
        }
    }, []);

    const connectToDevice = useCallback(async (device) => {
        const abortController = new AbortController();

        device.addEventListener('advertisementreceived', async (event) => {
            log('> Received advertisement from "' + device.name + '"...');
            // Stop watching advertisements to conserve battery life.
            abortController.abort();
            log('Connecting to GATT Server from "' + device.name + '"...');
            try {
                const server = await device.gatt.connect()
                log('> Bluetooth device "' + device.name + ' connected.');

                const service = await server.getPrimaryService(serviceUuid);
                characteristic = await service.getCharacteristic(characteristicUuid);
                document.getElementById('status').textContent = 'Connected!';
            } catch (error) {
                log('Argh! ' + error);
            }
        }, {once: true});

        try {
            log('Watching advertisements from "' + device.name + '"...');
            await device.watchAdvertisements({signal: abortController.signal});
        } catch (error) {
            log('Argh! ' + error);
        }
    }, [])

    const manualConnect = useCallback(async () => {
        try {
            log('Requesting any Bluetooth device...');
            const device = await navigator.bluetooth.requestDevice({
                filters: [{
                    services: [serviceUuid]
                }]
            });

            log('> Requested ' + device.name);
        } catch (error) {
            log('Argh! ' + error);
        }
    }, []);

    useEffect(() => {autoConnect()}, [])

    const sendCommand = useCallback(async (command) => {
        if (characteristic) {
            const encoder = new TextEncoder();
            await characteristic.writeValue(encoder.encode(command));
        }
    }, []);

    const setColor = useCallback(async (color) => {
        if (characteristic) {
            const command = 'COLOR:' + color.substring(1);
            const encoder = new TextEncoder();
            await characteristic.writeValue(encoder.encode(command));
        }
    }, []);

    return <div>
        <h1>BLE LED Control</h1>
        <div id="status">Not Connected</div>
        <button className="button" onClick={manualConnect}>Connect</button>
        <br/><br/>
        <input type="color" id="colorPicker" onChange={e => setColor(e.target.value)}/>
        <br/><br/>
        <button className="button" onClick={() => sendCommand('ON')}>ON</button>
        <button className="button" onClick={() => sendCommand('OFF')}>OFF</button>
        <button className="button" onClick={() => sendCommand('BREATH')}>BREATHING</button>
    </div>
}

export default App
