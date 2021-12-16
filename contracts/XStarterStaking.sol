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
    event APRChanged(uint256 newAPR, uint256 timestamp);
    struct Stake {
        address staker;
        uint256 stakeAmount;
        uint256 withdrawnInterestAmount;
        uint256 stakeTimestamp;
        bool active;
    }
    struct APRPeriod {
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 aprRate;
    }
    mapping(address => uint256) public userTiers;
    uint256[] public tierValues;
    Stake[] public stakeList;
    mapping(address => uint256) public userStakeAmount;
    uint256 public mintedXStarterTokens;
    uint256 public totalStakedTokens = 0;

    uint256 internal constant DAYS_IN_MONTHS = 30;
    uint256 internal constant DAY_IN_SECONDS = 86400;
    uint256 internal constant INITIAL_INTEREST_RATE = 10;
    uint256 internal constant THREE_MONTHS_INTEREST_RATE = 15;
    uint256 internal constant SIX_MONTHS_INTEREST_RATE = 20;
    uint256 internal constant THREE_MONTHS_DAYS = 90;
    uint256 internal constant INITIAL_MONTHS_DAYS = 60;
    uint256 internal constant DAYS_IN_FIVE_MONTHS = 150;
    uint256 internal constant SECONDS_IN_ONE_YEAR = 31536000;

    mapping (uint256 => APRPeriod) public aprPeriods;
    uint256 public aprPeriodsLength = 0;

    XStarterToken public xstarterToken;
    address admin;
    modifier onlyAdmin {
        require(msg.sender == admin, "Only admin can use this function!");
        _;
    }
     constructor(address _xstarterToken, address _admin, uint256[] memory _tierValues, uint256 initialAPR) public {
        tierValues = _tierValues;
        xstarterToken = XStarterToken(_xstarterToken);
        admin = _admin;
        aprPeriods[aprPeriodsLength] = APRPeriod(now, 0, initialAPR);
        aprPeriodsLength = aprPeriodsLength.add(1);
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
    function changeAPR(uint256 newAPR) onlyAdmin public {
        if(aprPeriodsLength > 0){
            aprPeriods[aprPeriodsLength.sub(1)].endTimestamp = now;
        }
        aprPeriods[aprPeriodsLength] = APRPeriod(now, 0, newAPR);
        aprPeriodsLength = aprPeriodsLength.add(1);
        emit APRChanged(newAPR, now);
    }
    function calculateInterestAmount(uint256 stakeIdx) public view returns(uint256){
        require(stakeIdx < stakeList.length, "XStarterStaking: Stake id is invalid");
        require(stakeList[stakeIdx].active, "XStarterStaking: Not active");
        uint256 i = aprPeriodsLength.sub(1);
        uint256 totalInterest = 0;
        bool loopActive = true;
        while(loopActive){
            uint256 fromTimestamp = 0;
            if(stakeList[stakeIdx].stakeTimestamp < aprPeriods[i].startTimestamp){
                fromTimestamp = aprPeriods[i].startTimestamp;
            } else {
                fromTimestamp = stakeList[stakeIdx].stakeTimestamp;
            }
            uint256 toTimestamp = 0;
            if(aprPeriods[i].endTimestamp == 0){
                toTimestamp = now;
            }else {
                toTimestamp = aprPeriods[i].endTimestamp;
            }
            uint256 secondsInAPRPeriod = SafeMath.sub(toTimestamp, fromTimestamp);
            uint256 interestInAPRPeriod = calculateInterest(secondsInAPRPeriod, stakeList[stakeIdx].stakeAmount, aprPeriods[i].aprRate);
            totalInterest = totalInterest.add(interestInAPRPeriod);
            if(stakeList[stakeIdx].stakeTimestamp >= aprPeriods[i].startTimestamp && (stakeList[stakeIdx].stakeTimestamp < aprPeriods[i].endTimestamp || aprPeriods[i].endTimestamp == 0)){
                loopActive = false;
            }
            if(i!=0){
                i = i.sub(1);
            }else{
                loopActive = false;
            }
        }
        return totalInterest;
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
        totalStakedTokens = SafeMath.add(totalStakedTokens, stakeAmount);
        xstarterToken.safeTransferFrom(msg.sender, address(this), stakeAmount);
        updateUserTier(msg.sender);
        emit CreateStake(
            stakeIdx,
            msg.sender,
            stakeAmount
        );
        return stakeIdx;
    }
     function calculateInterest(uint256 amountOfSeconds, uint256 stakeAmount, uint256 rate) private pure returns(uint256) {
        uint256 numerator = SafeMath.mul(amountOfSeconds, rate);
        numerator = SafeMath.mul(numerator, stakeAmount);
        uint256 denumerator = SafeMath.mul(SECONDS_IN_ONE_YEAR, 100);
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
        totalStakedTokens = SafeMath.sub(totalStakedTokens, stakeObj.stakeAmount);
        updateUserTier(stakeObj.staker);
        emit WithdrawReward(stakeIdx, stakeObj.staker, interestAmount);
    }
}