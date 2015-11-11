---
layout: post
title:  "Slack Alerts from VSO Release"
date:   2015-11-11
category: technology
tags: azure, vso
---
Visual Studio Online has built in support for Slack web hooks so that
various events can trigger a message to a Slack channel. These events
include things like code check in or build completion, but do not have
any triggers for Release Management. As a work around, we hooked up our
release definition manually and this post shows how.

![](/img/slackmessage.png)

<!-- more -->

The first clue pointing towards a solution was the existence of a
"cURL Upload Files" task. Although this task is restricted to uploading
files, its presence had me pondering whether this meant cURL was
installed on all release agents.

Adding a "Command Line" task with `curl.exe` defined as the tool soon
proved that it was and hooking up to Slack became as simple as
determining the exact format of the command required.

Slack's API documentation talks through the process of setting up
a [DIY Incoming WebHook](https://api.slack.com/incoming-webhooks)
which has a delightfully simple API. It simply needs a JSON document
POSTed to the given URI containing the text of the message we want
to send to our Slack channel.

A few minutes messing about in the Terminal later and I had the format
proven out.
{% highlight batch %}
curl -H "Content-Type: application/json" \
	 -X POST -d "{ \"text\": \"A test message.\", \"username\": \"release-bot\", \"channel\": \"@darran\" }" \
	 "https://hooks.slack.com/services/..."
{% endhighlight %}

Creating the Release Definition Task was then a formality, even making
use of the VSO variables in the arguments to template the message
posted to Slack, e.g. `"text": "$(Release.ReleaseName) deployment
complete"`.

![](/img/slackcurltask.png)