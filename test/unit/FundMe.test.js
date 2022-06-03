const { assert, expect } = require('chai');
const { deployments, ethers, getNamedAccounts } = require('hardhat');

describe('FundMe', async function () {
    let fundMe, deployer, mockV3Aggregator;
    const sendValue = ethers.utils.parseEther('1');
    beforeEach(async function () {
        // const accounts = await ethers.getSigners();
        // const accountZero = accounts[0];
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture('all');
        fundMe = await ethers.getContract('FundMe', deployer);
        mockV3Aggregator = await ethers.getContract('MockV3Aggregator', deployer);
    });

    describe('constructor', async function () {
        it('Sets the aggregator address correctly', async function () {
            const response = await fundMe.s_priceFeed();
            assert.equal(response, mockV3Aggregator.address)
        });
    });
    describe('fund', async function () {
        it('Fails if you don\'t send enough ETH', async function () {
            await expect(fundMe.fund()).to.be.revertedWith('You need to spend more ETH!');
        });
        it('Should fund some ETH', async function () {
            await fundMe.fund({ value: sendValue });
            const response = await fundMe.s_addressToAmountFunded
                (deployer);
            assert.equal(response.toString(), sendValue.toString());
        });
        it('Adds funder to the s_funders addresses', async function () {
            await fundMe.fund({ value: sendValue });
            const funder = await fundMe.s_funders(0);
            assert.equal(funder, deployer);
        });
    });
    describe('withdraw', async function () {
        beforeEach(async function () {
            await fundMe.fund({ value: sendValue });
        });
        it('Withdraw ETH from a single funder', async function () {
            const startingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
            const startingDeployerBalance = await fundMe.provider.getBalance(deployer);

            const transactionResponse = await fundMe.withdraw();
            const transactionReceipt = await transactionResponse.wait(1);

            const { gasUsed, effectiveGasPrice } = transactionReceipt;
            const gasCost = gasUsed.mul(effectiveGasPrice);

            const endingFundMeBalance = await fundMe.provider.getBalance(fundMe.address);
            const endingDeployerBalance = await fundMe.provider.getBalance(deployer);

            assert.equal(endingFundMeBalance, 0);
            assert.equal(
                startingFundMeBalance.add(startingDeployerBalance).toString(),
                endingDeployerBalance.add(gasCost).toString());
        });
        it('Only allows the owner to withdraw', async function () {
            const accounts = await ethers.getSigners();
            const attacker = accounts[1];
            const attackerConnectedAccount = await fundMe.connect(attacker);
            await expect(attackerConnectedAccount.withdraw()).to.be.revertedWith('FundMe__NotOwner');
        });
    });
});