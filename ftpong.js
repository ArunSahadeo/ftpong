const child_process = require('child_process'),
	Client = require('ftp'),
	fs = require('fs'),
	config = fs.existsSync('./config.json') ? require('./config.json') : false;

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

if (!config || Object.keys(config).length === 0)
{
	if (!config)
	{
		console.log('config.json does not exist');
	}
	else
	{
		console.log('config.json has no keys');
	}
	process.exit(1);
}

for (var key in config)
{
	const 
		keyName = key.charAt(0).toUpperCase() + key.substr(1),
		keyValue = config[key];

    switch (key)
	{
        case 'host':
			if (!keyValue.length)
			{
                console.log(keyName + ' is not set');
                process.exit(0);
			}

			if(!keyValue.match(/ftp[.](.*)/) && !keyValue.match(/([0-9]+)(.+)/))
            {
                console.log(keyName + ' does not contain a valid hostname');
                process.exit(0);
            }
        break;
		case 'user':
			if (!keyValue.length)
			{
				console.log(keyName + ' is not set');
				process.exit(0);
			}
		break;
		case 'pass':
			if (!keyValue.length)
			{
				console.log(keyName + ' is not set');
				process.exit(0);
			}
		break;
    }
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
    connectionParams = {
        host: config.host,
        user: config.user,
        password: config.pass
    };

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
