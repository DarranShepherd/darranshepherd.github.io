---
layout: post
title:  "Web-based Microcontroller Setup - Part 2"
date:   2025-04-16
excerpt: Part 2 of explorations into using Web Blueooth to communicate with a microcontroller from a web page. This experiment builds a Shelly client using just JavaScript and the Web Bluetooth API to make RPC calls to a Shelly relay.
---

* [Part 1 - BLE API exploration](/2025/04/15/web-based-microcontroller-setup-part-1)
* **Part 2 - JavaScript Shelly RPC client implementation**
* [Part 3 - Arduino sketch and setup webpage](/2025/04/17/web-based-microcontroller-setup-part-3)
* Part 4 - Prototype implementation

Shelly RPC implementation
=========================
Shelly expose the JSON RPC API for their IOT relays over a number of channels, an HTTP server, MQTT and also [Bluetooth](https://kb.shelly.cloud/knowledge-base/kbsa-communicating-with-shelly-devices-via-bluetoo). They've also documented the API and how to call it over Bluetooth which made this further exploration of Web Bluetooth a very easy process. If you have any Shelly devices on your network with Bluetooth enabled, open https://darranshepherd.co.uk/WebBTuC/experiment2.html to give it a try for yourself.

Device Selection
----------------
The page calls `getDevice` setting the company identifier to Shelly (0x0BA9) and lists the RPC over GATT service UUID in the optionalServices list. Specifying this allows us to connect to this service later on. The browser finds any and all available devices matching the filters and displays them to the user to select.

![Device Selection](/img/setup-experiment2-shelly-scan.png)

RPC Call - Get Device Info
--------------------------
Once the user has selected a device, I chose to first call the [GetDeviceInfo](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellygetdeviceinfo) method as this should be supported by all Shelly devices, whereas other methods applicability will vary depending on which device the user selects.

```json
{
    "method": "Shelly.GetDeviceInfo",
    "params": {}
}
```

Making this request is a matter of following the docs to format the JSON request as a UTF-8 byte array, then write the length of the request as a 4 byte big endian integer to the TX characteristic. We then write the JSON request to the Data characteristic. Once the Shelly device has received the correct number of bytes, it parses the request and executes the method. The length of the response is made available via reading the RX characteristic. This response might exceed the length of data available in a single Bluetooth Maximum Transmission Unit, so the Data characteristic is read repeatedly until the number of bytes indicated by the RX characteristic have been read.

Once the response has been received, we can parse it as JSON and then use it as we see fit.

![GetDeviceInfo Response](/img/setup-experiment2-get-device-info.png)

We can use the same code to make any arbitrary RPC call to the device as listed in the documentation. To facilitate this, the page has a textarea into which you can enter any RPC request and the response will be displayed next to it. Here getting the status of a switch on a Shelly Plus 2PM including power consumption.

![Switch.GetStatus](/img/setup-experiment2-rpc.png)

With the JavaScript API side proven out, the next step is to get it talking to a simple Arduino sketch and actually test out the original concept.