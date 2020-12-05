# haraka-plugin-rcpt-dynamo

[![build](https://github.com/mfogel/haraka-plugin-rcpt-dynamo/workflows/build/badge.svg)](https://github.com/mfogel/haraka-plugin-rcpt-dynamo/actions?query=workflow%3Abuild)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/haraka-plugin-rcpt-dynamo.svg)](https://www.npmjs.com/package/haraka-plugin-rcpt-dynamo)

A [Haraka](https://github.com/haraka/Haraka) plugin that checks if recipients are in a dynamo table.

## Install

- add this plugin as a dependency of your haraka project (ie. using npm or yarn)
- add `rcpt-dynamo` to your haraka project's `config/plugins`

## Configure

There are two required configuration items which can be set by creating two one-line files in your haraka's `config` directory.

- `rcpt-dynamo.table-name`: The name of the dynamo table to query for recipients.
- `rcpt-dynamo.hash-key-name`: The name of the attribute that is the hash key. This attribute should contain the email addresses for which you want to receive mail.

AWS Credentials are assumed to be provided out-of-band (ie. via environment variables, IAM role attached to EC2 instance, etc)

## Changelog

### v0.1

- initial release
