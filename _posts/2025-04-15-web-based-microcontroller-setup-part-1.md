---
layout: post
title:  "Web-based Microcontroller Setup - Part 1"
date:   2025-04-15
excerpt: An initial exploration into using Web Blueooth to communicate with a microcontroller from a web page with a view to using this as a simple way of setting up a new device without using the Wireless Access Point and captive portal.
---

* **Part 1 - BLE API exploration**
* [Part 2 - JavaScript Shelly RPC client implementation](/2025/04/16/web-based-microcontroller-setup-part-2)
* [Part 3 - Arduino sketch and setup webpage](/2025/04/17/web-based-microcontroller-setup-part-3)
* Part 4 - Prototype implementation

When Raspberry Pi [announced SDK support for Bluetooth Low Energy (BLE)](https://www.raspberrypi.com/news/new-functionality-bluetooth-for-pico-w/) on the Pico W in 2023, I recalled seeing a W3C standard for [Web Bluetooth](https://www.w3.org/community/web-bluetooth/) some time before and I started wondering whether this would make for an easy way to get a new device based on the Pico W. A lot of IOT devices walk users through a potentially confusing process of connecting to a WiFi access point hosted by the device, connect to a web server hosted on the microcontroller and then enter the network credentials to allow it to connect to WiFi. The user then has to reconnect to their home WiFi network and finish the configuration, either using that local web server, or perhaps through a cloud interface that the device can now connect to. Could a web page using Web Bluetooth connect to the device using BLE and configure everthing without that network dance? I promptly did nothing with this idea until recently, when I have been playing with BLE on an ESP32 for another project idea. Drawing upon this experience with BLE from the microcontroller side, I experimented a little to see what's possible and this blog series is the culmination of those experiments.

Web Bluetooth API exploration
==============================

[Experiment 1](https://darranshepherd.co.uk/WebBTuC/experiment1.html) | [GitHub](https://github.com/DarranShepherd/WebBTuC/blob/main/experiment1.html)

I started off just playing around with the Web Bluetooth API to get a feel for how it works, picking a device and exploring the services and characteristics available. I've got a few Shelly relays in my office, so I picked the Shelly manufacturer identifier and service UUID to use in the `requestDevice` call.

![Experiment 1 screenshot](/img/setup-experiment1-scan.png)

Once a device is selected, this initial test code does the bare minimum and logs everything it's doing to the textarea. It connects to the GATT server, gets the [Mongoose OS RPC over GATT service](https://github.com/mongoose-os-libs/rpc-gatts) and reads the RX CTL characteristic.

![Experiment 1 screenshot](/img/setup-experiment1.png)

Whilst this test isn't anything to set the world alight, it did allow me to prove that the Web Bluetooth API is relatively easy to use. I initially thought it was a little inconsistent as I would see many errors and failures until I twigged that the Bluetooth hardware in my desktop PC would be relying on the same 2.4GHz antenna as WiFi - an antenna I hadn't connected because my desktop PC has a hard-wired ethernet connection. With the antenna connected, BLE connections and requests were rock solid.

The other thing that this early experiment allowed for at an early stage was testing on other devices. I already knew that Safari on iOS doesn't support Web Bluetooth, but Chrome and Samsung Internet on Android should and indeed does.

![Samsung Internet and Chrom on Android](/img/setup-experiment1-android.png)