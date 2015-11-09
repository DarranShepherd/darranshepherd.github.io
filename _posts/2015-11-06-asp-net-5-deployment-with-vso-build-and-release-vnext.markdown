---
layout: post
title:  "ASP.Net 5 deployment with VSO Build and Release vNext"
date:   2015-11-06 18:03:58
category: technology
tags: azure, vso, ASP.Net 5
---
Microsoft has documented the [process for building and deploying ASP.Net 5 applications](https://msdn.microsoft.com/en-us/Library/vs/alm/Build/azure/deploy-aspnet5?f=255&MSPPError=-2147217396)
to Azure Web Apps using Visual Studio Online build, but accomplishes the deployment
using a PowerShell step in the build pipeline. We want to make use of VSO Release
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
package the output of `dnu publish` into a Zip file suitable for
deployment with the `Publish-AzureWebSiteProject` cmdlet.
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

With a VSO Release vNext definition created and linked to the build
definition set up above, we automatically have access to the Zip
file artifact containing the output of `dnu publish`. Passing this
file to the `Publish-AzureWebSiteProject` cmdlet by adding an Azure Web
App Deployment task handles connecting to our Azure subscription,
uploading the package to the web app and unzipping. But accessing the
website results in

![You do not have permission to view this directory or page.](/img/NoPermission.png)
 
 Using the excellent Kudu diagnostic console
 (yourwebsite.scm.azurewebsites.net) we can look at the folder layout
 and spot our prolem.
 
{% highlight batch%}
D:\home>tree \A
Folder PATH listing for volume Windows
Volume serial number is 002FEB7C FEFD:D936
D:.
+---data
|   \---aspnet
|       \---CompilationSnapshots
+---LogFiles
|   \---kudu
|       +---deployment
|       \---trace
\---site
    +---deployments
    |   \---tools
    +---diagnostics
    +---locks
    \---wwwroot
        +---approot
        |   +---packages
        |   +---runtimes
        |   \---src
        |       +---MyProject.Web
        |           +---App_Data
        |           +---Controllers
        |           +---Models
        |           +---Properties
        |           \---Views
        |               +---Home
        |               \---Shared
        \---wwwroot
            +---css
            +---img
            +---js
            \---lib
{% endhighlight %}

`dnu publish` packs up the web application with web assets and a
web.config configuring the httpPlatformHandler in a wwwroot folder, and
all runtimes, packages and assemblies in an approot folder. The problem?
`Publish-AzureWebSiteProject` uploads and extracts our Zipped artifact
under /site/wwwroot folder of the site, not directly into /site as we
need.   

### Reconfigure
So how to resolve this? I started digging around in the [source code](https://github.com/Azure/azure-powershell/blob/f2674a6648b6fb25a3de337044a77d226ae9af2d/src/ServiceManagement/Services/Commands/Websites/PublishAzureWebsiteProject.cs) 
for `Publish-AzureWebSiteProject` to see if there might be a
configuration option but without any joy. So the next step was to try
reconfiguring the web app configuration. [This SO thread](http://stackoverflow.com/questions/32613513/asp-net-5-mvc-6-publish-azurewebsiteproject-incorrect-directory-structure)
pointed to this being a working solution and a quick test by changing
the configuration in the Azure Preview Portal proved it worked.

![Virtual Directory Config](/img/VirtualDirectories.png)

I wasn't keen on leaving this as a pre-requisite of the site configuration
for the deployment to work, especially as our reason for using VSO
Release is to be able to deploy to multiple environments. A bit of
hunting around found [David Ebbo](http://blog.davidebbo.com) explaining
[how to use Azure Resource Management PowerShell](https://social.msdn.microsoft.com/Forums/azure/en-US/990f41fd-f8b6-43a0-b942-cef0308120b2/add-virtual-application-and-directory-to-an-azure-website-using-powershell?forum=windowsazurewebsitespreview)
to script this sort of update. An Azure PowerShell script task in VSO
makes sure this is done with each deployment. This isn't entirely as
straightforward as it might sound given that the underlying ARM
REST API doesn't support management certificate authentication, so
we need to use an [AD Service User with the PowerShell commands](http://blogs.msdn.com/b/tomholl/archive/2014/11/25/unattended-authentication-to-azure-management-apis-with-azure-active-directory.aspx).

{% highlight powershell %}
Param(
  [string]$user, 
  [string]$password, 
  [string]$resourceGroupName, 
  [string]$siteName
)
$securepassword = ConvertTo-SecureString -String $apssword -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($user, $securepassword)
Add-AzureAccount -Credential $cred

Switch-AzureMode -Name AzureResourceManager

$PropertiesObject = @{
	"virtualApplications" = @(
        @{
            "virtualPath" = "/";
            "physicalPath" = "site\wwwroot\wwwroot";
        }
    )
}
Set-AzureResource -PropertyObject $PropertiesObject -ResourceGroupName $resourceGroupName -ResourceType Microsoft.Web/sites/config -ResourceName "$siteName/web" -OutputObjectFormat New -ApiVersion 2015-08-01 -Force
{% endhighlight %}

## Conclusion

The documentation was mostly there for us to implement our automated
build strategy with just a few minor pieces of the puzzle missing,
mainly around running unit tests. Guidance on how to use VSO Release
vNext to manage releasing an ASP.Net 5 application to Azure was tricky
to come by, but a bit of trial and error has got us there. Hopefully
this blog post will help anyone else that finds themselves facing
similar challengs.

Modifying the virtual directory configuration of the web app feels
dirty but I'm hoping this is a temporary fix until
`Publish-AzureWebSiteProject` or similar has better support for
uploading the package into /site instead of /site/wwwroot. If it does
prove to be a longer term solution, then as our solution matures
to the level where we have an ARM template for our Azure architecture
then we should be able to incorporate the virtual directory
configuration into the web app definition and not require the separate
PowerShell step. 
