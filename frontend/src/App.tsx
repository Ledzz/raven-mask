import {useState} from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

let characteristic = null;
let devices = [];
let device = null;
const serviceUuid = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const characteristicUuid = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const log = console.log;

async function manualConnect() {
    devices = [];
    localStorage.removeItem('lastDeviceId');
    connect();
}

async function onConnectToBluetoothDevicesButtonClick() {
    try {
        log('Getting existing permitted Bluetooth devices...');
        const devices = await navigator.bluetooth.getDevices();

        log('> Got ' + devices.length + ' Bluetooth devices.');
        // These devices may not be powered on or in range, so scan for
        // advertisement packets from them before connecting.
        for (const device of devices) {
            connectToBluetoothDevice(device);
        }
    } catch (error) {
        log('Argh! ' + error);
    }
}

async function connectToBluetoothDevice(device) {
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
}

async function onRequestBluetoothDeviceButtonClick() {
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
}

onConnectToBluetoothDevicesButtonClick();

// async function connect() {
//     try {
//         const lastDeviceId = localStorage.getItem('lastDeviceId');
//
//         if (lastDeviceId && devices.length > 0) {
//             device = devices.find(d => d.id === lastDeviceId);
//         } else {
//
//             device = await navigator.bluetooth.requestDevice({
//                 filters: [{
//                     services: [serviceUuid]
//                 }]
//             });
//             localStorage.setItem('lastDeviceId', device.id);
//         }
//         console.log(device);
//         const server = await device.gatt.connect();
//         const service = await server.getPrimaryService(serviceUuid);
//         characteristic = await service.getCharacteristic(characteristicUuid);
//         document.getElementById('status').textContent = 'Connected!';
//         document.querySelectorAll('button:not(:first-child)').forEach(btn => btn.disabled = false);
//         document.getElementById('colorPicker').disabled = false;
//
//     } catch (error) {
//         console.log('Error:', error);
//         document.getElementById('status').textContent = 'Error: ' + error;
//     }
// }
//
async function sendCommand(command) {
    if (characteristic) {
        const encoder = new TextEncoder();
        await characteristic.writeValue(encoder.encode(command));
    }
}

async function setColor(color) {
    if (characteristic) {
        const command = 'COLOR:' + color.substring(1);
        const encoder = new TextEncoder();
        await characteristic.writeValue(encoder.encode(command));
    }
}

function App() {

    return <div>
        <h1>BLE LED Control</h1>
        <div id="status">Not Connected</div>
        <button className="button" onClick={manualConnect}>Connect</button>
        <br/><br/>
        <input type="color" id="colorPicker" onChange={e => setColor(e.target.value)} />
        <br/><br/>
        <button className="button" onClick={() => sendCommand('ON')} >ON</button>
        <button className="button" onClick={() => sendCommand('OFF')} >OFF</button>
        <button className="button" onClick={() => sendCommand('BREATH')} >BREATHING</button>
    </div>
}

export default App
