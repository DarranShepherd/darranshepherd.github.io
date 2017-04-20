---
layout: post
title:  "Self-signed certificate with Subject Alternative Name for IIS Express"
date:   2017-04-20 18:00:00
category: technology
tags: development, windows, .Net
---
17 years after RFC 2818 deprecated the use of the commonName attribute in an SSL certificate as a means of identifying the domain name for which its valid, [Chrome 58 has enforced it](https://www.chromestatus.com/features/4981025180483584).

Our first hint at this was when a colleague found his development environment suddenly broken. Chrome was reporting "Your connection is not private" when connecting to IIS Express.

The security tab in the developer tools gave the next clue with an error stating "Subject Alternative Name Missing".

Fixing it, however, took a bit of digging. I would hope there's an easier way to fix this, but I threw together this Powershell script that seems to do the job (run as Administrator).

<script src="https://gist.github.com/DarranShepherd/ff362511058df469b2809a4f4d2246e6.js"></script>
