import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import {
  JobMarketplace__factory,
  MockERC20__factory,
  Multisig__factory,
} from "../typechain-types";

enum JobStatus {
  Open,
  Funded,
  Submitted,
  Completed,
  Rejected,
  Expired,
}

const DESCRIPTION = "Build a landing page";
const DELIVERABLE_REF = ethers.id("localStorage:deliverable:1");
const APPROVAL_REASON = ethers.id("approved");
const REJECTION_REASON = ethers.id("rejected");

describe("JobMarketplace", function () {
  async function deployFixture() {
    const [
      client,
      provider,
      evaluator,
      other,
      claimant,
      signerTwo,
      signerThree,
    ] = await ethers.getSigners();

    const token = await new MockERC20__factory(client).deploy();

    const marketplace = await new JobMarketplace__factory(client).deploy(
      await token.getAddress(),
    );

    const budget = ethers.parseUnits("100", 18);
    const clientTestMint = ethers.parseUnits("1000", 18);

    await token.mint(client.address, clientTestMint);

    const initialClientBalance = await token.balanceOf(client.address);

    async function futureExpiration() {
      return (await time.latest()) + 60 * 60;
    }

    async function createJob(options?: {
      jobProvider?: string;
      jobEvaluator?: string;
      jobBudget?: bigint;
      expiresAt?: number;
    }) {
      const expiresAt = options?.expiresAt ?? (await futureExpiration());
      await marketplace
        .connect(client)
        .createJob(
          DESCRIPTION,
          options?.jobBudget ?? budget,
          options?.jobEvaluator ?? evaluator.address,
          options?.jobProvider ?? provider.address,
          expiresAt,
        );

      return {
        jobId: (await marketplace.jobCount()) - 1n,
        expiresAt,
      };
    }

    async function createAndFundJob(options?: {
      jobProvider?: string;
      jobEvaluator?: string;
      expiresAt?: number;
    }) {
      const created = await createJob(options);
      await token
        .connect(client)
        .approve(await marketplace.getAddress(), budget);
      await marketplace.connect(client).fund(created.jobId);

      return created;
    }

    async function createFundedAndSubmittedJob(options?: {
      jobProvider?: string;
      jobEvaluator?: string;
      expiresAt?: number;
    }) {
      const created = await createAndFundJob(options);
      await marketplace
        .connect(provider)
        .submit(created.jobId, DELIVERABLE_REF);

      return created;
    }

    return {
      client,
      provider,
      evaluator,
      other,
      claimant,
      signerTwo,
      signerThree,
      token,
      marketplace,
      budget,
      initialClientBalance,
      futureExpiration,
      createJob,
      createAndFundJob,
      createFundedAndSubmittedJob,
    };
  }

  describe("Happy path", function () {
    it("creates, funds, submits, completes, and pays the provider", async function () {
      const {
        client,
        provider,
        evaluator,
        token,
        marketplace,
        budget,
        createJob,
      } = await loadFixture(deployFixture);

      const { jobId } = await createJob();

      await token
        .connect(client)
        .approve(await marketplace.getAddress(), budget);
      await expect(marketplace.connect(client).fund(jobId))
        .to.emit(marketplace, "JobFunded")
        .withArgs(jobId, client.address, budget);

      await expect(marketplace.connect(provider).submit(jobId, DELIVERABLE_REF))
        .to.emit(marketplace, "JobSubmitted")
        .withArgs(jobId, provider.address, DELIVERABLE_REF);

      await expect(
        marketplace.connect(evaluator).complete(jobId, APPROVAL_REASON),
      )
        .to.emit(marketplace, "JobCompleted")
        .withArgs(jobId, evaluator.address, provider.address, APPROVAL_REASON);

      const job = await marketplace.getJob(jobId);

      expect(job.status).to.equal(JobStatus.Completed);
      expect(await token.balanceOf(provider.address)).to.equal(budget);
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(
        0n,
      );
    });
  });

  describe("Rejections", function () {
    it("allows the client to reject an Open job without moving tokens", async function () {
      const { client, token, marketplace, createJob } = await loadFixture(
        deployFixture,
      );
      const { jobId } = await createJob();
      const clientBalanceBefore = await token.balanceOf(client.address);

      await expect(marketplace.connect(client).reject(jobId, REJECTION_REASON))
        .to.emit(marketplace, "JobRejected")
        .withArgs(jobId, client.address, REJECTION_REASON);

      const job = await marketplace.getJob(jobId);

      expect(job.status).to.equal(JobStatus.Rejected);
      expect(await token.balanceOf(client.address)).to.equal(
        clientBalanceBefore,
      );
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(
        0n,
      );
    });

    it("allows the evaluator to reject a Funded job and refund the client", async function () {
      const {
        client,
        evaluator,
        token,
        marketplace,
        budget,
        initialClientBalance,
        createAndFundJob,
      } = await loadFixture(deployFixture);
      const { jobId } = await createAndFundJob();

      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(
        budget,
      );

      await expect(
        marketplace.connect(evaluator).reject(jobId, REJECTION_REASON),
      )
        .to.emit(marketplace, "JobRejected")
        .withArgs(jobId, evaluator.address, REJECTION_REASON);

      const job = await marketplace.getJob(jobId);

      expect(job.status).to.equal(JobStatus.Rejected);
      expect(await token.balanceOf(client.address)).to.equal(
        initialClientBalance,
      );
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(
        0n,
      );
    });

    it("allows the evaluator to reject a Submitted job and refund the client", async function () {
      const {
        client,
        evaluator,
        token,
        marketplace,
        initialClientBalance,
        createFundedAndSubmittedJob,
      } = await loadFixture(deployFixture);
      const { jobId } = await createFundedAndSubmittedJob();

      await marketplace.connect(evaluator).reject(jobId, REJECTION_REASON);

      const job = await marketplace.getJob(jobId);

      expect(job.status).to.equal(JobStatus.Rejected);
      expect(await token.balanceOf(client.address)).to.equal(
        initialClientBalance,
      );
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(
        0n,
      );
    });
  });

  describe("Expiration refunds", function () {
    it("allows any account to claim a refund from Funded after expiration", async function () {
      const {
        client,
        claimant,
        token,
        marketplace,
        initialClientBalance,
        createAndFundJob,
      } = await loadFixture(deployFixture);
      const { jobId, expiresAt } = await createAndFundJob();

      await time.increaseTo(expiresAt + 1);

      await expect(marketplace.connect(claimant).claimRefund(jobId))
        .to.emit(marketplace, "RefundClaimed")
        .withArgs(jobId, claimant.address);

      const job = await marketplace.getJob(jobId);

      expect(job.status).to.equal(JobStatus.Expired);
      expect(await token.balanceOf(client.address)).to.equal(
        initialClientBalance,
      );
      expect(await token.balanceOf(await marketplace.getAddress())).to.equal(
        0n,
      );
    });

    it("allows any account to claim a refund from Submitted after expiration", async function () {
      const {
        client,
        other,
        token,
        marketplace,
        initialClientBalance,
        createFundedAndSubmittedJob,
      } = await loadFixture(deployFixture);
      const { jobId, expiresAt } = await createFundedAndSubmittedJob();

      await time.increaseTo(expiresAt + 1);
      await marketplace.connect(other).claimRefund(jobId);

      const job = await marketplace.getJob(jobId);

      expect(job.status).to.equal(JobStatus.Expired);
      expect(await token.balanceOf(client.address)).to.equal(
        initialClientBalance,
      );
    });

    it("prevents the evaluator from completing a Submitted job after expiration", async function () {
      const { evaluator, marketplace, createFundedAndSubmittedJob } =
        await loadFixture(deployFixture);
      const { jobId, expiresAt } = await createFundedAndSubmittedJob();

      await time.increaseTo(expiresAt + 1);

      await expect(
        marketplace.connect(evaluator).complete(jobId, APPROVAL_REASON),
      ).to.be.revertedWithCustomError(marketplace, "JobExpired");
    });
  });

  describe("Access control", function () {
    it("reverts when setProvider is called by someone other than the client", async function () {
      const { other, provider, marketplace, createJob } = await loadFixture(
        deployFixture,
      );
      const { jobId } = await createJob({ jobProvider: ethers.ZeroAddress });

      await expect(
        marketplace.connect(other).setProvider(jobId, provider.address),
      ).to.be.revertedWithCustomError(marketplace, "NotClient");
    });

    it("reverts when fund is called by someone other than the client", async function () {
      const { other, token, marketplace, budget, createJob } =
        await loadFixture(deployFixture);
      const { jobId } = await createJob();

      await token
        .connect(other)
        .approve(await marketplace.getAddress(), budget);

      await expect(
        marketplace.connect(other).fund(jobId),
      ).to.be.revertedWithCustomError(marketplace, "NotClient");
    });

    it("reverts when submit is called by someone other than the provider", async function () {
      const { other, marketplace, createAndFundJob } = await loadFixture(
        deployFixture,
      );
      const { jobId } = await createAndFundJob();

      await expect(
        marketplace.connect(other).submit(jobId, DELIVERABLE_REF),
      ).to.be.revertedWithCustomError(marketplace, "NotProvider");
    });

    it("reverts when complete is called by someone other than the evaluator", async function () {
      const { other, marketplace, createFundedAndSubmittedJob } =
        await loadFixture(deployFixture);
      const { jobId } = await createFundedAndSubmittedJob();

      await expect(
        marketplace.connect(other).complete(jobId, APPROVAL_REASON),
      ).to.be.revertedWithCustomError(marketplace, "NotEvaluator");
    });

    it("reverts when reject is called by an incorrect account in Open", async function () {
      const { other, marketplace, createJob } = await loadFixture(
        deployFixture,
      );
      const { jobId } = await createJob();

      await expect(
        marketplace.connect(other).reject(jobId, REJECTION_REASON),
      ).to.be.revertedWithCustomError(marketplace, "NotClient");
    });

    it("reverts when reject is called by an incorrect account in Funded", async function () {
      const { other, marketplace, createAndFundJob } = await loadFixture(
        deployFixture,
      );
      const { jobId } = await createAndFundJob();

      await expect(
        marketplace.connect(other).reject(jobId, REJECTION_REASON),
      ).to.be.revertedWithCustomError(marketplace, "NotEvaluator");
    });

    it("reverts when reject is called by an incorrect account in Submitted", async function () {
      const { other, marketplace, createFundedAndSubmittedJob } =
        await loadFixture(deployFixture);
      const { jobId } = await createFundedAndSubmittedJob();

      await expect(
        marketplace.connect(other).reject(jobId, REJECTION_REASON),
      ).to.be.revertedWithCustomError(marketplace, "NotEvaluator");
    });
  });

  describe("Multisig evaluator", function () {
    it("completes only after the Multisig reaches threshold and executes the call", async function () {
      const {
        client,
        provider,
        evaluator,
        signerTwo,
        signerThree,
        token,
        marketplace,
        budget,
        initialClientBalance,
        createFundedAndSubmittedJob,
      } = await loadFixture(deployFixture);

      const multisig = await new Multisig__factory(evaluator).deploy(
        [evaluator.address, signerTwo.address, signerThree.address],
        2,
      );
      const multisigAddress = await multisig.getAddress();

      const { jobId } = await createFundedAndSubmittedJob({
        jobEvaluator: multisigAddress,
      });

      await expect(
        marketplace.connect(evaluator).complete(jobId, APPROVAL_REASON),
      ).to.be.revertedWithCustomError(marketplace, "NotEvaluator");

      const calldata = marketplace.interface.encodeFunctionData("complete", [
        jobId,
        APPROVAL_REASON,
      ]);

      await multisig
        .connect(evaluator)
        .createProposal(await marketplace.getAddress(), 0, calldata);
      await multisig.connect(evaluator).approveProposal(0);
      await multisig.connect(signerTwo).approveProposal(0);

      await expect(multisig.connect(evaluator).executeProposal(0))
        .to.emit(multisig, "ProposalExecuted")
        .withArgs(0);

      const job = await marketplace.getJob(jobId);

      expect(job.status).to.equal(JobStatus.Completed);
      expect(await token.balanceOf(provider.address)).to.equal(budget);
      expect(await token.balanceOf(client.address)).to.equal(
        initialClientBalance - budget,
      );
    });
  });

  describe("Validation and invalid transitions", function () {
    it("reverts when creating a job with zero evaluator address", async function () {
      const { client, marketplace, budget, futureExpiration } =
        await loadFixture(deployFixture);

      await expect(
        marketplace
          .connect(client)
          .createJob(
            DESCRIPTION,
            budget,
            ethers.ZeroAddress,
            ethers.ZeroAddress,
            await futureExpiration(),
          ),
      ).to.be.revertedWithCustomError(marketplace, "ZeroAddress");
    });

    it("reverts when creating a job with zero budget", async function () {
      const { client, evaluator, provider, marketplace, futureExpiration } =
        await loadFixture(deployFixture);

      await expect(
        marketplace
          .connect(client)
          .createJob(
            DESCRIPTION,
            0,
            evaluator.address,
            provider.address,
            await futureExpiration(),
          ),
      ).to.be.revertedWithCustomError(marketplace, "InvalidBudget");
    });

    it("reverts when creating a job with invalid expiration", async function () {
      const { client, evaluator, provider, marketplace, budget } =
        await loadFixture(deployFixture);
      const pastExpiration = await time.latest();

      await expect(
        marketplace
          .connect(client)
          .createJob(
            DESCRIPTION,
            budget,
            evaluator.address,
            provider.address,
            pastExpiration,
          ),
      ).to.be.revertedWithCustomError(marketplace, "InvalidExpiration");
    });

    it("reverts when funding without enough allowance", async function () {
      const { client, token, marketplace, createJob } = await loadFixture(
        deployFixture,
      );
      const { jobId } = await createJob();

      await expect(
        marketplace.connect(client).fund(jobId),
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("reverts when completing twice", async function () {
      const { evaluator, marketplace, createFundedAndSubmittedJob } =
        await loadFixture(deployFixture);
      const { jobId } = await createFundedAndSubmittedJob();

      await marketplace.connect(evaluator).complete(jobId, APPROVAL_REASON);

      await expect(
        marketplace.connect(evaluator).complete(jobId, APPROVAL_REASON),
      )
        .to.be.revertedWithCustomError(marketplace, "InvalidStatus")
        .withArgs(JobStatus.Completed);
    });

    it("reverts when claiming a refund before expiration", async function () {
      const { claimant, marketplace, createAndFundJob } = await loadFixture(
        deployFixture,
      );
      const { jobId } = await createAndFundJob();

      await expect(
        marketplace.connect(claimant).claimRefund(jobId),
      ).to.be.revertedWithCustomError(marketplace, "JobNotExpired");
    });

    it("reverts when claiming a refund in terminal states", async function () {
      const { claimant, evaluator, marketplace, createFundedAndSubmittedJob } =
        await loadFixture(deployFixture);
      const { jobId, expiresAt } = await createFundedAndSubmittedJob();

      await marketplace.connect(evaluator).complete(jobId, APPROVAL_REASON);
      await time.increaseTo(expiresAt + 1);

      await expect(marketplace.connect(claimant).claimRefund(jobId))
        .to.be.revertedWithCustomError(marketplace, "InvalidStatus")
        .withArgs(JobStatus.Completed);
    });

    it("reverts when submitting without an assigned provider", async function () {
      const { provider, marketplace, createAndFundJob } = await loadFixture(
        deployFixture,
      );
      const { jobId } = await createAndFundJob({
        jobProvider: ethers.ZeroAddress,
      });

      await expect(
        marketplace.connect(provider).submit(jobId, DELIVERABLE_REF),
      ).to.be.revertedWithCustomError(marketplace, "ProviderRequired");
    });
  });
});
