# Hello World App

This is the Scaffoldly "Hello World" app.

It is used:

- To demonstrate Scaffoldly is working
- As the default image when a new Scaffoldly app is deployed

## Deployment

```
$(saml-to assume aws@scaffold.ly --headless)
npm run deploy
```

## Notes

- The ECR Permissions for `557208059266.dkr.ecr.us-east-1.amazonaws.com/scaffoldly-hello-world` has been modified so any account can pull this image.
