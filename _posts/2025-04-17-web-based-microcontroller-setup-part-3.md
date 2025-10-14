---
layout: post
title:  "Web-based Microcontroller Setup - Part 3"
date:   2025-04-17
excerpt: My first attempt at Web Blueooth communicating with an Arduino sketch running on an ESP32 microcontroller from a web page to configure WiFi and then call an API on the uC.
---

* [Part 1 - BLE API exploration](/2025/04/15/web-based-microcontroller-setup-part-1)
* [Part 2 - JavaScript Shelly RPC client implementation](/2025/04/16/web-based-microcontroller-setup-part-2)
* **Part 3 - Arduino sketch and setup webpage**
* Part 4 - Prototype implementation

Arduino sketch and setup webpage
================================
This is the first experiment to test feasibility of the original concept and it did throw up one or two wrinkles that had to be handled. It comprises a very bare bones Arduino sketch sets up a Seeed XIAO ESP32-C6 to advertise the required Bluetooth characteristics and a [companion web page](https://darranshepherd.co.uk/WebBTuC/experiment3.html) that hosts the JavaScript client side of the process.

Network Scanning
--------------

The [Arduino sketch](https://github.com/DarranShepherd/WebBTuC/blob/main/experiment3/experiment3.ino) is a rough and ready prototype implementing the idea with minimal error handling and no care paid to code structure.

It advertises a GATT service using a custom UUID. The service comprises a writeable characteristic used to trigger a scan of available WiFi networks that when read returns the number of networks found. There are then 10 characteristics that can be read to retrieve available network SSIDs. Once these have been used to identify the correct network, the selected SSID and password can be written to two more characteristics.

Exposing so many characteristics didn't initially thrown any errors, but scanning with LightBlue showed only a subset. This was resolved by increasing the number of handles from the default 15 when creating the service (each characteristic uses 2 handles).

```cpp
pService = pServer->createService(BLEUUID(WIFI_SERVICE_UUID), 32);
```

The scan characteristic gets a callback used to trigger the scan process when written to.
```cpp
class ScanCallback: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    uint8_t *data = pCharacteristic->getData();

    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    int scanCount = WiFi.scanNetworks();
    for (int i = 0; i < scanCount; i++) {
      if (i > 9) break;

      String ssid; uint8_t encryptionType; int32_t RSSI; uint8_t* BSSID; int32_t channel;
      WiFi.getNetworkInfo(i, ssid, encryptionType, RSSI, BSSID, channel);
      Serial.printf("%d: %s, Ch:%d (%ddBm) %d\n", i + 1, ssid.c_str(), channel, RSSI, encryptionType);
      pCharScanSsids[i]->setValue(ssid);
    }
    pCharacteristic->setValue(scanCount);
  }
};

pCharScan->setCallbacks(new ScanCallback());
```

The corresponding client JavaScript selects the device, connects to the service and writes to the scan characteristic. It then loops through the SSID list characteristics to retreive the available networks and show these to the user.

![Available networks](/img/setup-experiment3-scan.png)

Connect to Network
------------------
Once the user has picked the relevant network, they enter the WiFi pre-shared key and hit Connect. This writes the selected SSID to one characteristic and the PSK to another. The sketch checks that both have been written and if so, attempts to connect to the WiFi network.

The `loop()` of the sketch keeps checking the WiFi status and once connected, sets the IpAddr characteristic value to the IP address. This characteristic is configured with `BLECharacteristic::PROPERTY_NOTIFY` so the page can subscribe to notifications and an event is triggered when it's received, providing the page with the IP address assigned to the device.

Call Device API
---------------
At this point, I thought I'd reached the limit of possibilities as Web Bluetooth requires a secure context, which then means we can't make a mixed content fetch request to the device as it's exposing an unsecured HTTP API. However, I stumbled upon the [Private Network Access W3C proposal](https://wicg.github.io/private-network-access/) which has similar browser support to Web Bluetooth.

![CanIUse for Web Bluetooth and targetAddressSpace](/img/setup-experiment3-caniuse.png)

By adding a couple of extra headers to the response from the Device, and a flag on the `fetch` call, we can allow the secure setup page to call out to the API. This means that the device only needs to handle API requests and the UI of the configuration can be served from the web, which makes maintenance significantly simpler.

```cpp
client.println("HTTP/1.1 200 OK");
client.println("Content-type:application/json");
client.println("Connection: close");
client.println("Access-Control-Allow-Origin: *");
client.println("Access-Control-Allow-Private-Network: true");
client.println("Private-Network-Access-ID: 01:02:03:04:05:06");
client.printf("Private-Network-Access-Name: %s\n", deviceId);
client.println();
client.printf("{ \"deviceId\": \"%s\", \"millis\": %d}\n", deviceId, millis());
```

```javascript
let response = await fetch(`http://${ipAddr}/`, { targetAddressSpace: 'private' });
let obj = await response.json();
```

![API response](/img/setup-experiment3-api.png)