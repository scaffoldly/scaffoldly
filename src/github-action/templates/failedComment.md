### 🚨 Unable to update `{%= state.branch %}`!

🤔 Review the [Deploy Logs]({%= state.deployLogsUrl %}) and re-run once the issue is resolved. Enable Debug Logging when re-running the action for more detail.

- **CI/CD Logs:** [{%= state.deployLogsUrl %}]({%= state.deployLogsUrl %})
- **Commit:** `{%= state.commitSha %}`
- **Stage:** `{%= state.secretName %}`

{% if (moreInfo) { %}

<details open>
<summary>Additional Information</summary>
{%- moreInfo %}
</details>

{% } %}
