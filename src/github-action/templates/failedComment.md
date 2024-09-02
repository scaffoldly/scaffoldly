### 🚨 Unable to update `{%= status.branch %}`!

🤔 Review the [Deploy Logs]({%= status.deployLogsUrl %}) and re-run once the issue is resolved. Enable Debug Logging when re-running the action for more detail.

- **CI/CD Logs:** [{%= status.deployLogsUrl %}]({%= status.deployLogsUrl %})
- **Commit:** `{%= status.commitSha %}`
- **Stage:** `{%= status.secretName %}`

{% if (moreInfo) { %}

<details open>
<summary>Additional Information</summary>
{%- moreInfo %}
</details>

{% } %}
