#!/usr/bin/env node

const
	child_process = require('child_process'),
	Client = require('ftp'),
	fs = require('fs'),
	readline = require('readline-sync');

function britifyDate(dateString)
{
	return dateString.split('-').reverse().join('-');
}

function parseCmd(cmd)
{
    try
    {
        return child_process.execSync(cmd).toString();
    }
    catch (error)
    {
        return error.status;
    }
}

if (!fs.existsSync('.git'))
{
    console.error('You must be in a Git repository.');
    process.exit(1);
}

const
	trackedFiles = [],
	gitListedFiles = parseCmd('git ls-files');

Array.from(gitListedFiles.split(/\r?\n/)).forEach(function(file)
{
	if (!file.length) return;
	trackedFiles.push(file);
});

var c = new Client(),
    connectionParams = {};

function uploadToServer()
{
	c.on('ready', function()
	{
		const siteRoots = ['public_html'];
		
		c.list(function(err, dirs)
		{
			if (err) throw err;

			let siteRoot = dirs.filter(dir => dir.type === 'd' && siteRoots.includes(dir.name));
			siteRoot = siteRoot[0];

			if (!siteRoot)
			{
				console.log('Cannot find the DocumentRoot');
				process.exit(1);
			}

			c.cwd(siteRoot.name, function(err)
			{
				if (err) throw err;
			});

			c.pwd(function(err, pwd)
			{
				if (err) throw err;
				console.log(`Changed current working directory to ${pwd}`);
			});

			trackedFiles.forEach(function(trackedFile)
			{
				const
					dateString = new Date().toISOString().slice(0, 10),
					GMTDateString = britifyDate(dateString),
					backupFileName = trackedFile.replace(/([.][a-z|A-Z]+)/, `-${GMTDateString}$1`); 
					
				c.rename(trackedFile, backupFileName, function(err)
				{
					if (err) return;

					console.log(`Renaming ${trackedFile} to ${backupFileName}`);
				});

				c.put(trackedFile, trackedFile, function(err)
				{
					if (err) return;

					console.log(`Uploading ${trackedFile} to ${trackedFile}`);
				});

			});

			c.end();
		});

	});

	c.on('error', function(err)
	{
		console.log(`Server returned status code ${err.code}`);
		process.exit(1);
	});

	try 
	{
		c.connect(connectionParams);
	}
	catch (error)
	{
		throw error;
	}
}

function main()
{

	let hostname = readline.question('Please enter the hostname: ');

	if ( String(hostname.trim()).length > 0 && !hostname.match(/ftp[.](.*)/) && !hostname.match(/([0-9]+)(.+)/))
	{
		console.log('Hostname must either be an IP address or follow the ftp.domain format');
		process.exit(1);
	}

	if ( String(hostname.trim()).length < 1 )
	{
		console.log('Hostname cannot be empty!');
		process.exit(1);
	}

	connectionParams['host'] = hostname;

	let username = readline.question('Please enter the username: ');

	if ( String(username.trim()).length < 1 )
	{
		console.log('Username cannot be empty!');
		process.exit(1);
	}

	connectionParams['user'] = username;

	let password = readline.question('Please enter the password: ');

	if ( String(password.trim()).length < 1 )
	{
		console.log('Password cannot be empty!');
		process.exit(1);
	}

	connectionParams['password'] = password;

	function checkConnectionProps()
	{

		let connectionProps = Object.getOwnPropertyNames(connectionParams);

		if ( connectionProps.indexOf('host') === -1 && connectionProps.indexOf('user') === -1 && connectionProps.indexOf('password') === -1 )
		{
			console.log('No connection properties have been provided.');
			process.exit(1);
		}

		uploadToServer();
	}

	checkConnectionProps();
}

main();
