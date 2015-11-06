---
layout: post
title:  "ASP.Net 5 deployment with VSO Build and Release vNext"
date:   2015-11-06 18:03:58
category: technology
tags: azure, vso, ASP.Net 5
---
Microsoft has documented the [process for building and deploying ASP.Net 5 applications](https://msdn.microsoft.com/en-us/Library/vs/alm/Build/azure/deploy-aspnet5?f=255&MSPPError=-2147217396)
to Azure Web Apps using Visual Studio Online build, but accomplishes the deployment
using a PowerShell step in the build pipeline. We wanted to make use of VSO Release
Management vNext to be able to stage releases through different environments. This
post shows how we finally got this up and running.

<!-- more -->

* [Build](#build)
  * [Test](#test)
  * [Publish](#publish)
* [Release](#release)
  * [Deploy](#deploy)
  * [Reconfigure](#reconfigure)
* [Conclusion](#conclusion)

## Build

Microsoft's [documentation](https://msdn.microsoft.com/en-us/Library/vs/alm/Build/azure/deploy-aspnet5?f=255&MSPPError=-2147217396)
gave us the starting point for this step. The PreBuild.ps1 script provided takes care
of bootstrapping the DNX runtime onto the build agent and selecting the right runtime
based on the solution's global.json and the Visual Studio build step builds and
packages the web project (using dnu publish under the covers). However, the first
problem we encountered was how to run the XUnit unit tests and failing the build if
they don't all pass.

### Test

Our test projects are using xUnit and have a "test" command defined in the
project.json, allowing them to be executed using `dnx test`.

{% highlight json %}
"commands": { 
  "test": "xunit.runner.dnx" 
}
{% endhighlight %}

At least they could be if only
this didn't result in `The term 'dnx' is not recognized as the name of a cmdlet, function, script file, or operable program.`.
Despite the presence of the `-p` argument to `dnvm install` the `dnx`
command was still not available to a subsequent PowerShell execution
task.

The solution proved to be a slight modification to the PreBuild.ps1 to
set an alias for the DNX runtime version installed.

{% highlight powershell %}
& $env:USERPROFILE\.dnx\bin\dnvm install $dnxVersion -p
& $env:USERPROFILE\.dnx\bin\dnvm alias default $dnxVersion
{% endhighlight %}

The test script then calls `dnvm use default` before it tries to run
`dnx test`. In addition, the RunTests.ps1 script passes the `-xml`
argument to `dnx test` which tells the xUnit test runner to output
test results to an xml file that VSO can use to present nicely
formatted details of test execution by adding a Publish Test Results
build step.

{% highlight powershell %}
Param([string]$version)
dnvm use default
Get-ChildItem -Path $PSScriptRoot\test -Filter project.json -Recurse |% { 
	& dnu restore $_.FullName 2>1
	& dnx -p $_.FullName test -xml "TEST-$version.xml"
}
{% endhighlight %}

### Publish

The final build step added to the build definition in VSO was to
package the output of `dnu publish` into a ZIP file suitable for
deployment with the `Publish-AzureWebSiteProject` commandlet.
Another PowerShell script calling out to the .Net `System.IO.ZipFile`
class checked into source control is run by a PowerShell build step,
passing in the path to the publish folder as the source parameter.

{% highlight powershell %}
Param([string]$source, [string]$destination)

Write-Host "Zipping $source to $destination"
if ( Test-Path $destination ) {
    Write-Host "Deleting existing destination file $destination"
    Remove-Item $destination
}

Add-Type -AssemblyName "System.IO.Compression.FileSystem"
[IO.Compression.ZipFile]::CreateFromDirectory($source, $destination)
{% endhighlight %}


## Release

### Deploy

### Reconfigure

## Conclusion