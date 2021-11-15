pragma solidity 0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./XStarterToken.sol";

contract XStarterStaking {
    using SafeMath for uint256;
    using SafeERC20 for XStarterToken;
    event CreateStake(
        uint256 idx,
        address user,
        uint256 stakeAmount
    );
    event ReceiveStakeReward(uint256 idx, address user, uint256 rewardAmount);
    event WithdrawReward(uint256 idx, address user, uint256 rewardAmount);
    event WithdrawStake(uint256 idx, address user,  uint256 rewardAmount);
    struct Stake {
        address staker;
        uint256 stakeAmount;
        uint256 withdrawnInterestAmount;
        uint256 stakeTimestamp;
        bool active;
    }
    mapping(address => uint256) public userTiers;
    uint256[] public tierValues;
    Stake[] public stakeList;
    mapping(address => uint256) public userStakeAmount;
    uint256 public mintedXStarterTokens;
    
    uint256 internal constant DAYS_IN_MONTHS = 30;
    uint256 internal constant DAY_IN_SECONDS = 86400;
    uint256 internal constant INITIAL_INTEREST_RATE = 10;
    uint256 internal constant THREE_MONTHS_INTEREST_RATE = 15;
    uint256 internal constant SIX_MONTHS_INTEREST_RATE = 20;
    uint256 internal constant THREE_MONTHS_DAYS = 90;
    uint256 internal constant INITIAL_MONTHS_DAYS = 60;
    uint256 internal constant DAYS_IN_FIVE_MONTHS = 150;
    XStarterToken public xstarterToken;
    address admin;
    modifier onlyAdmin {
        require(msg.sender == admin, "Only admin can use this function!");
        _;
    }
     constructor(address _xstarterToken, address _admin, uint256[] memory _tierValues) public {
        tierValues = _tierValues;
        xstarterToken = XStarterToken(_xstarterToken);
        admin = _admin;
    }
    
    function amountOfTiers() public view returns(uint256){
        return tierValues.length;
    }
    function updateUserTier(address user) private {
        uint256 userTier = 0;
        for (uint256 i = 0; i < tierValues.length; i ++){
            if(userStakeAmount[user] >= tierValues[i]){
                userTier = i;
            }
        }
        userTiers[user] = userTier;
    }
    function updateTierValues(uint256[] memory _tierValues) public onlyAdmin{
        tierValues = _tierValues;
    }
    function updateSpecificTierValue(uint256 tierValue, uint256 tierIndex) public onlyAdmin{
        require(tierValue >= 0 && tierIndex >= 0 && tierIndex < tierValues.length, "Wrong input values.");
        tierValues[tierIndex] = tierValue;
    }
    function updateSenderTier() public {
        require(userStakeAmount[msg.sender] > 0, "You didn't stake any coins. Your tier is 0.");
        updateUserTier(msg.sender);
    }
    function stake(uint256 stakeAmount) public returns (uint256 stakeIdx) {
        stakeIdx = stakeList.length;
        stakeList.push(
            Stake({
                staker: msg.sender,
                stakeAmount: stakeAmount,
                withdrawnInterestAmount: 0,
                stakeTimestamp: now,
                active: true
            })
        );
        userStakeAmount[msg.sender] = SafeMath.add(userStakeAmount[msg.sender], stakeAmount);
        xstarterToken.safeTransferFrom(msg.sender, address(this), stakeAmount);
        updateUserTier(msg.sender);
        emit CreateStake(
            stakeIdx,
            msg.sender,
            stakeAmount
        );
        return stakeIdx;
    }
    function calculateInterestAmount(uint256 stakeIdx) public view returns(uint256){
        require(stakeIdx < stakeList.length, "XStarterStaking: Stake id is invalid");
        require(stakeList[stakeIdx].active, "XStarterStaking: Not active");
        uint256 timePassed = SafeMath.sub(now, stakeList[stakeIdx].stakeTimestamp);
        uint256 timePassedInDays = SafeMath.div(timePassed, DAY_IN_SECONDS);
        uint256 timePassedInMonths = SafeMath.div(timePassedInDays, DAYS_IN_MONTHS);
        uint256 totalInterestAmount = 0;
        if(timePassedInMonths >= 5){
            uint256 daysPassedAfterSixMonths = SafeMath.sub(timePassedInDays, DAYS_IN_FIVE_MONTHS);
            uint256 interestAmountAfterSixMonths = calculateInterest(daysPassedAfterSixMonths, stakeList[stakeIdx].stakeAmount, SIX_MONTHS_INTEREST_RATE);
            uint256 interestAmountAfterThreeMonths = calculateInterest(THREE_MONTHS_DAYS, stakeList[stakeIdx].stakeAmount, THREE_MONTHS_INTEREST_RATE);
            uint256 interestAmountAfterFirstMonths = calculateInterest(INITIAL_MONTHS_DAYS, stakeList[stakeIdx].stakeAmount, INITIAL_INTEREST_RATE);
            totalInterestAmount = SafeMath.add(interestAmountAfterSixMonths, interestAmountAfterThreeMonths);
            totalInterestAmount = SafeMath.add(totalInterestAmount, interestAmountAfterFirstMonths);
        }else if(timePassedInMonths >= 2){
            uint256 daysPassedAfterThreeMonths = SafeMath.sub(timePassedInDays, INITIAL_MONTHS_DAYS);
            uint256 interestAmountAfterThreeMonths = calculateInterest(daysPassedAfterThreeMonths, stakeList[stakeIdx].stakeAmount, THREE_MONTHS_INTEREST_RATE);
            uint256 interestAmountAfterFirstMonths = calculateInterest(INITIAL_MONTHS_DAYS, stakeList[stakeIdx].stakeAmount, INITIAL_INTEREST_RATE);
            totalInterestAmount = SafeMath.add(interestAmountAfterThreeMonths, interestAmountAfterFirstMonths);
        }else {
            totalInterestAmount = calculateInterest(timePassedInDays, stakeList[stakeIdx].stakeAmount, INITIAL_INTEREST_RATE);
        }
        return totalInterestAmount;
    }
    function calculateInterest(uint256 amountOfDays, uint256 stakeAmount, uint256 rate) private pure returns(uint256) {
        uint256 numerator = SafeMath.mul(amountOfDays, stakeAmount);
        numerator = SafeMath.mul(numerator, rate);
        uint256 denumerator = SafeMath.mul(100, DAYS_IN_MONTHS);
        return SafeMath.div(numerator, denumerator);
    }
    function withdraw(uint256 stakeIdx) public {
        Stake storage stakeObj = stakeList[stakeIdx];
        require(
            stakeObj.staker == msg.sender,
            "XStarterStaking: Sender not staker"
        );
        require(stakeObj.active, "XStarterStaking: Not active");
        uint256 interestAmount = calculateInterestAmount(stakeIdx);
        uint256 totalWithdrawAmount = SafeMath.add(interestAmount, stakeObj.stakeAmount);
        mintedXStarterTokens = mintedXStarterTokens.add(interestAmount);
        xstarterToken.mint(address(this), interestAmount);
        xstarterToken.safeTransfer(stakeObj.staker, totalWithdrawAmount);
        stakeObj.active = false;
        stakeObj.withdrawnInterestAmount = interestAmount;
        userStakeAmount[stakeObj.staker] = SafeMath.sub(userStakeAmount[stakeObj.staker], stakeObj.stakeAmount);
        updateUserTier(stakeObj.staker);
        emit WithdrawReward(stakeIdx, stakeObj.staker, interestAmount);
    }
}