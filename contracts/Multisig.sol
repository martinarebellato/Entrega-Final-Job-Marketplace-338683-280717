// SPDX-License-Identifier: MIT
pragma solidity >=0.8.2 <0.9.0;

contract Multisig {
    struct Proposal {
        address proposer;
        address destination;
        uint256 value;
        bytes data;
        uint256 approvals;
        bool executed;
        bool cancelled;
    }

    address[] public signers;
    uint256 public threshold;
    uint256 public proposalCount;

    mapping(address => bool) public isSigner;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    error InvalidThreshold();
    error InvalidSigner();
    error NotSigner();
    error InvalidDestination();
    error ProposalNotFound();
    error AlreadyApproved();
    error AlreadyExecuted();
    error AlreadyCancelled();
    error NotEnoughApprovals();
    error ExecutionFailed();
    error OnlyProposer();

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address destination,
        uint256 value,
        bytes data
    );

    event ProposalApproved(uint256 indexed proposalId, address indexed signer);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);

    modifier onlySigner() {
        if (!isSigner[msg.sender]) {
            revert NotSigner();
        }

        _;
    }

    constructor(address[] memory initialSigners, uint256 initialThreshold) {
        if (initialThreshold == 0 || initialThreshold > initialSigners.length) {
            revert InvalidThreshold();
        }

        for (uint256 i = 0; i < initialSigners.length; i++) {
            address signer = initialSigners[i];

            if (signer == address(0) || isSigner[signer]) {
                revert InvalidSigner();
            }

            isSigner[signer] = true;
            signers.push(signer);
        }

        threshold = initialThreshold;
    }

    function createProposal(
        address destination,
        uint256 value,
        bytes calldata data
    ) external onlySigner {
        if (destination == address(0)) {
            revert InvalidDestination();
        }

        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            proposer: msg.sender,
            destination: destination,
            value: value,
            data: data,
            approvals: 0,
            executed: false,
            cancelled: false
        });

        proposalCount++;

        emit ProposalCreated(proposalId, msg.sender, destination, value, data);
    }

    function approveProposal(uint256 proposalId) external onlySigner {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.proposer == address(0)) {
            revert ProposalNotFound();
        }

        if (proposal.executed) {
            revert AlreadyExecuted();
        }

        if (proposal.cancelled) {
            revert AlreadyCancelled();
        }

        if (hasApproved[proposalId][msg.sender]) {
            revert AlreadyApproved();
        }

        hasApproved[proposalId][msg.sender] = true;
        proposal.approvals++;

        emit ProposalApproved(proposalId, msg.sender);
    }

    function executeProposal(uint256 proposalId) external onlySigner {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.proposer == address(0)) {
            revert ProposalNotFound();
        }

        if (proposal.executed) {
            revert AlreadyExecuted();
        }

        if (proposal.cancelled) {
            revert AlreadyCancelled();
        }

        if (proposal.approvals < threshold) {
            revert NotEnoughApprovals();
        }

        proposal.executed = true;

        (bool success, ) = payable(proposal.destination).call{
            value: proposal.value
        }(proposal.data);

        if (!success) {
            revert ExecutionFailed();
        }

        emit ProposalExecuted(proposalId);
    }

    function cancelProposal(uint256 proposalId) external onlySigner {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.proposer == address(0)) {
            revert ProposalNotFound();
        }

        if (proposal.executed) {
            revert AlreadyExecuted();
        }

        if (proposal.cancelled) {
            revert AlreadyCancelled();
        }

        if (proposal.proposer != msg.sender) {
            revert OnlyProposer();
        }

        proposal.cancelled = true;

        emit ProposalCancelled(proposalId);
    }

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address proposer,
            address destination,
            uint256 value,
            bytes memory data,
            uint256 approvals,
            bool executed,
            bool cancelled
        )
    {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.proposer == address(0)) {
            revert ProposalNotFound();
        }

        return (
            proposal.proposer,
            proposal.destination,
            proposal.value,
            proposal.data,
            proposal.approvals,
            proposal.executed,
            proposal.cancelled
        );
    }

    function hasSignerApproved(uint256 proposalId, address signer)
        external
        view
        returns (bool)
    {
        return hasApproved[proposalId][signer];
    }

    receive() external payable {}
}
