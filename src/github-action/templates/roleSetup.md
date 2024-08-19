Please follow these instructions to ensure the application can deploy to AWS:

1. If you haven't already, create an Identity Provider in AWS IAM for GitHub Actions:

   - Go to: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html
   - For the **Provider URL**: `https://token.actions.githubusercontent.com`
   - For the **Audience**: `sts.amazonaws.com`

2. Create or update a role in AWS IAM with the following **Trust Policy**:

   ```
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:{%= state.owner %}/{%= state.repo %}:*"
           }
         }
       }
     ]
   }
   ```

   Be sure to replace `YOUR_ACCOUNT_ID` with your AWS Account ID.

3. Add the following policy to ensure Serverless can deploy to your account:

   ```
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Effect": "Allow",
               "Action": [
                   "dynamodb:*",
                   "s3:*",
                   "sns:*",
                   "sqs:*",
                   "cloudformation:*",
                   "lambda:*",
                   "iam:*",
                   "apigateway:*",
                   "secretsmanager:*",
                   "logs:*",
                   "xray:*",
                   "events:*"
               ],
               "Resource": "*"
           }
       ]
   }
   ```

4. Add the AWS IAM Role ARN to your GitHub Repository Variables:

   - Visit: https://github.com/{%= state.owner %}/{%= state.repo %}/settings/variables/actions
   - **Variable Name**: `DEPLOYMENT_ROLE`
   - **Variable Value**: `arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_ROLE_NAME`

   Be sure to replace `YOUR_ACCOUNT_ID` with your AWS Account ID and `YOUR_ROLE_NAME` with the AWS IAM Role Name.

5. Re-run [this action]({%= state.logsUrl %}). Enable debug logging if you need more detail.
