// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract JobMarketplace is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum JobStatus {
        Open,
        Funded,
        Submitted,
        Completed,
        Rejected,
        Expired
    }

    struct Job {
        address client;
        address evaluator;
        address provider;
        string description;
        uint256 budget;
        uint256 expiresAt;
        JobStatus status;
        bytes32 deliverableRef;
    }

    IERC20 public immutable paymentToken;
    Job[] private jobList;

    error ZeroAddress();
    error EmptyDescription();
    error InvalidBudget();
    error InvalidExpiration();
    error JobNotFound();
    error NotClient();
    error NotProvider();
    error NotEvaluator();
    error ProviderAlreadySet();
    error ProviderRequired();
    error InvalidStatus(JobStatus currentStatus);
    error JobExpired();
    error JobNotExpired();
    error EmptyDeliverableRef();

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed evaluator,
        address provider,
        string description,
        uint256 budget,
        uint256 expiresAt
    );
    event ProviderSet(uint256 indexed jobId, address indexed provider);
    event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount);
    event JobSubmitted(uint256 indexed jobId, address indexed provider, bytes32 deliverableRef);
    event JobCompleted(uint256 indexed jobId, address indexed evaluator, address indexed provider, bytes32 reason);
    event JobRejected(uint256 indexed jobId, address indexed rejectedBy, bytes32 reason);
    event RefundClaimed(uint256 indexed jobId, address indexed claimedBy);

    constructor(IERC20 token) {
        if (address(token) == address(0)) {
            revert ZeroAddress();
        }

        paymentToken = token;
    }

    function createJob(
        string calldata description,
        uint256 budget,
        address evaluator,
        address provider,
        uint256 expiresAt
    ) external returns (uint256 jobId) {
        if (bytes(description).length == 0) {
            revert EmptyDescription();
        }

        if (budget == 0) {
            revert InvalidBudget();
        }

        if (evaluator == address(0)) {
            revert ZeroAddress();
        }

        if (expiresAt <= block.timestamp) {
            revert InvalidExpiration();
        }

        jobId = jobList.length;

        jobList.push(
            Job({
                client: msg.sender,
                evaluator: evaluator,
                provider: provider,
                description: description,
                budget: budget,
                expiresAt: expiresAt,
                status: JobStatus.Open,
                deliverableRef: bytes32(0)
            })
        );

        emit JobCreated(jobId, msg.sender, evaluator, provider, description, budget, expiresAt);
    }

    function setProvider(uint256 jobId, address provider) external {
        Job storage job = _getJob(jobId);

        if (msg.sender != job.client) {
            revert NotClient();
        }

        if (job.status != JobStatus.Open) {
            revert InvalidStatus(job.status);
        }

        if (job.provider != address(0)) {
            revert ProviderAlreadySet();
        }

        if (provider == address(0)) {
            revert ZeroAddress();
        }

        job.provider = provider;

        emit ProviderSet(jobId, provider);
    }

    function fund(uint256 jobId) external nonReentrant {
        Job storage job = _getJob(jobId);

        if (msg.sender != job.client) {
            revert NotClient();
        }

        if (job.status != JobStatus.Open) {
            revert InvalidStatus(job.status);
        }

        if (block.timestamp > job.expiresAt) {
            revert JobExpired();
        }

        job.status = JobStatus.Funded;
        paymentToken.safeTransferFrom(msg.sender, address(this), job.budget);

        emit JobFunded(jobId, msg.sender, job.budget);
    }

    function submit(uint256 jobId, bytes32 deliverableRef) external {
        Job storage job = _getJob(jobId);

        if (job.provider == address(0)) {
            revert ProviderRequired();
        }

        if (msg.sender != job.provider) {
            revert NotProvider();
        }

        if (job.status != JobStatus.Funded) {
            revert InvalidStatus(job.status);
        }

        if (block.timestamp > job.expiresAt) {
            revert JobExpired();
        }

        if (deliverableRef == bytes32(0)) {
            revert EmptyDeliverableRef();
        }

        job.deliverableRef = deliverableRef;
        job.status = JobStatus.Submitted;

        emit JobSubmitted(jobId, msg.sender, deliverableRef);
    }

    function complete(uint256 jobId, bytes32 reason) external nonReentrant {
        Job storage job = _getJob(jobId);

        if (msg.sender != job.evaluator) {
            revert NotEvaluator();
        }

        if (job.status != JobStatus.Submitted) {
            revert InvalidStatus(job.status);
        }

        if (block.timestamp > job.expiresAt) {
            revert JobExpired();
        }

        if (job.provider == address(0)) {
            revert ProviderRequired();
        }

        job.status = JobStatus.Completed;
        paymentToken.safeTransfer(job.provider, job.budget);

        emit JobCompleted(jobId, msg.sender, job.provider, reason);
    }

    function reject(uint256 jobId, bytes32 reason) external nonReentrant {
        Job storage job = _getJob(jobId);
        JobStatus status = job.status;

        if (status == JobStatus.Open) {
            if (msg.sender != job.client) {
                revert NotClient();
            }

            job.status = JobStatus.Rejected;
            emit JobRejected(jobId, msg.sender, reason);
            return;
        }

        if (status == JobStatus.Funded || status == JobStatus.Submitted) {
            if (msg.sender != job.evaluator) {
                revert NotEvaluator();
            }

            job.status = JobStatus.Rejected;
            paymentToken.safeTransfer(job.client, job.budget);

            emit JobRejected(jobId, msg.sender, reason);
            return;
        }

        revert InvalidStatus(status);
    }

    function claimRefund(uint256 jobId) external nonReentrant {
        Job storage job = _getJob(jobId);

        if (block.timestamp <= job.expiresAt) {
            revert JobNotExpired();
        }

        if (job.status != JobStatus.Funded && job.status != JobStatus.Submitted) {
            revert InvalidStatus(job.status);
        }

        job.status = JobStatus.Expired;
        paymentToken.safeTransfer(job.client, job.budget);

        emit RefundClaimed(jobId, msg.sender);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return _getJob(jobId);
    }

    function jobCount() external view returns (uint256) {
        return jobList.length;
    }

    function _getJob(uint256 jobId) private view returns (Job storage) {
        if (jobId >= jobList.length) {
            revert JobNotFound();
        }

        return jobList[jobId];
    }
}
