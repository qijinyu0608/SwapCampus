import { PRODUCT_CATEGORY_NAMES } from '../../constants/productCategories';
import type { PublishingRules } from '../../services/api';

export const defaultAllowedCategories = [...PRODUCT_CATEGORY_NAMES];
export const defaultDormElectricalWhitelist = ['电脑', '非充电台灯', '手机', '平板电脑', '20000mAh以下充电宝', '电动牙刷', '电动剃须刀', '相机'];
export const defaultCommunityNotices = [
  '宿舍电器请优先控制在校内允许使用和交易的范围内，发布前自行确认宿舍管理要求。',
  '交易优先选择图书馆、食堂、公寓楼下等校内公共区域，建议当面验货后再确认。',
  '商品标题和描述请写清成色、配件、容量或版本，避免同学误判。'
];
export const defaultRuleHighlights = [
  '商品提交后直接上架展示',
  '发布人需自行保证标题、描述和图片真实一致',
  '宿舍电器请按白名单和校内用电要求谨慎发布',
  '平台保留基于举报或运营巡检下架违规内容的权利'
];
export const defaultTrustSignals = ['实名认证', '校内面交', '交易留痕'];
export const defaultProhibitedKeywords = ['刀具', '代抢', '账号'];
export const defaultReviewFlow = ['实名认证', '填写商品信息', '直接上架'];
export const defaultServiceRuleHighlights = [
  '服务信息提交后默认直接展示，但平台可基于举报、抽检和风险识别随时复核',
  '服务发布人需如实说明服务内容、时效、交付方式、金额和名额限制',
  '涉及跑腿、代办、陪同、技能协助等服务时，不得超出个人能力或校园管理允许范围',
  '平台有权对虚假接单、恶意占单、失联爽约和引流站外交易等行为限制发布'
];
export const defaultServiceReviewFlow = ['实名认证', '填写服务信息', '阅读并确认规则', '直接展示'];
export const defaultServiceTrustSignals = ['实名认证', '站内消息留痕', '订单状态记录', '信用分反馈'];
export const defaultServiceCommunityNotices = [
  '服务标题、说明、预计耗时、交付方式和截止时间应填写完整，避免形成模糊需求或无法履约的承诺。',
  '涉及线下见面、代取代送、物品交接或进入宿舍楼宇等场景时，应优先遵守校园出入、宿管和安全管理要求。',
  '服务协作建议全程使用站内消息确认时间、地点、金额、额外成本和完成标准，避免口头约定引发争议。'
];
export const defaultServiceProhibitedItems = [
  '代课点名',
  '考试作弊',
  '代写作业',
  '代抢受限资源',
  '账号租售',
  '校外引流',
  '危险品运输',
  '灰色跑腿'
];

export type PublishRulesDocumentProps = {
  allowedCategories: string[];
  communityNotices: string[];
  dormElectricalWhitelist: string[];
  prohibitedKeywords: string[];
  reviewFlow: string[];
  ruleHighlights: string[];
  trustSignals: string[];
  serviceCommunityNotices: string[];
  serviceProhibitedItems: string[];
  serviceReviewFlow: string[];
  serviceRuleHighlights: string[];
  serviceTrustSignals: string[];
};

export function resolvePublishingRulesDocumentProps(rules: PublishingRules | null): PublishRulesDocumentProps {
  return {
    allowedCategories: rules?.allowedCategories ?? defaultAllowedCategories,
    dormElectricalWhitelist: rules?.dormElectricalWhitelist ?? defaultDormElectricalWhitelist,
    communityNotices: rules?.communityNotices ?? defaultCommunityNotices,
    ruleHighlights: rules?.ruleHighlights ?? defaultRuleHighlights,
    prohibitedKeywords: rules?.prohibitedKeywords ?? defaultProhibitedKeywords,
    reviewFlow: rules?.reviewFlow ?? defaultReviewFlow,
    trustSignals: rules?.trustSignals ?? defaultTrustSignals,
    serviceCommunityNotices: defaultServiceCommunityNotices,
    serviceProhibitedItems: defaultServiceProhibitedItems,
    serviceReviewFlow: defaultServiceReviewFlow,
    serviceRuleHighlights: defaultServiceRuleHighlights,
    serviceTrustSignals: defaultServiceTrustSignals
  };
}

export function PublishRulesDocument({
  allowedCategories,
  communityNotices,
  dormElectricalWhitelist,
  prohibitedKeywords,
  reviewFlow,
  ruleHighlights,
  trustSignals,
  serviceCommunityNotices,
  serviceProhibitedItems,
  serviceReviewFlow,
  serviceRuleHighlights,
  serviceTrustSignals
}: PublishRulesDocumentProps) {
  return (
    <article className="publish-rules-document" aria-label="发布规则">
      <section className="publish-rules-document-section">
        <h4>第一条 适用范围</h4>
        <p>
          本规则适用于用户通过 SwapCampus 平台发布的全部商品与校园服务信息，包括标题、分类、价格、图片、描述、标签、履约说明、名额设置及其他补充信息。平台有权依据本规则对发布内容进行留痕、展示限制、下架及后续复核处理。
        </p>
      </section>

      <section className="publish-rules-document-section">
        <h4>第二条 发布信息真实性要求</h4>
        <ol className="publish-rules-legal-list">
          <li>发布人应当如实填写商品或服务的标题、价格、状态、配件、能力边界、履约条件、名额和时效要求，不得隐瞒影响交易判断的重要事实。</li>
          <li>图片、描述和补充说明应与实际发布内容保持一致，不得使用夸大、误导、模糊、明显不完整或与事实不符的表述，不得冒用他人图片或虚构履约能力。</li>
          <li>凡涉及线下面交、物品交付、代办执行、陪同服务或持续预约的，发布人应明确时间范围、地点范围、额外成本和完成标准，确保其他同学能够直接理解和核验。</li>
        </ol>
      </section>

      <section className="publish-rules-document-section">
        <h4>第三条 商品类目与实物发布要求</h4>
        <p>当前允许发布的商品分类如下：</p>
        <p className="publish-rules-inline-list">{allowedCategories.join('、')}。</p>
        <p>
          发布人应当按照商品实际属性选择分类。平台发现分类明显错误、故意规避规则或借用其他分类发布受限物品的，有权要求修改或下架处理。
        </p>
      </section>

      <section className="publish-rules-document-section">
        <h4>第四条 宿舍电器发布限制</h4>
        <p>宿舍电器仅限以下白名单物品可以发布：</p>
        <p className="publish-rules-inline-list">{dormElectricalWhitelist.join('、')}。</p>
        <p>
          白名单范围以外的宿舍电器原则上不建议发布。对于违反校园用电管理要求或存在明显安全风险的物品，平台可在发现后下架处理。
        </p>
      </section>

      <section className="publish-rules-document-section">
        <h4>第五条 通用禁止发布内容</h4>
        <ol className="publish-rules-legal-list">
          <li>禁止发布命中平台禁售词、涉嫌规避监管、违规代办、账号交易或其他高风险内容的商品信息。</li>
          <li>当前重点识别的禁售或高风险关键词示例如下：{prohibitedKeywords.join('、')}。</li>
          <li>禁止通过拆分表述、谐音替代、图片暗示或标签误导等方式规避平台规则。平台一经识别，有权下架并记录风险行为。</li>
        </ol>
      </section>

      <section className="publish-rules-document-section">
        <h4>第六条 服务发布专项约束</h4>
        <ol className="publish-rules-legal-list">
          <li>服务发布应当基于本人真实可履约的时间、能力和可达范围，不得发布明显超出个人能力、依赖校方限制资源或无法稳定履约的内容。</li>
          <li>服务描述中应写明服务边界、是否含材料费或垫付、交付方式、报名或预约条件、可服务时段、取消条件以及是否支持多人同时预约。</li>
          <li>禁止发布违反校纪校规、教学考试纪律、宿舍管理要求、网络安全要求或其他校园治理要求的服务。</li>
          <li>以下服务或需求属于重点禁止范围：{serviceProhibitedItems.join('、')}。</li>
          <li>禁止借服务发布之名进行兼职拉人头、刷单返利、校外导流、站外支付诱导、灰黑产协助或其他与校园互助场景明显不符的行为。</li>
          <li>涉及代取快递、代送物品、陪诊陪同、技能培训、维修安装、资料处理等场景时，发布人应承担相应说明义务，不得设置隐藏条件或临时大幅变更承诺内容。</li>
        </ol>
      </section>

      <section className="publish-rules-document-section">
        <h4>第七条 交易、履约与安全要求</h4>
        <ol className="publish-rules-legal-list">
          {communityNotices.map((item) => (
            <li key={item}>{item}</li>
          ))}
          {serviceCommunityNotices.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li>平台鼓励用户保留必要的交易沟通记录、验货记录和交付记录。当前交易保障机制包括：{trustSignals.join('、')}。</li>
          <li>服务协作相关的补充保障机制包括：{serviceTrustSignals.join('、')}。</li>
        </ol>
      </section>

      <section className="publish-rules-document-section">
        <h4>第八条 发布生效与处置方式</h4>
        <p>发布内容提交后默认进入展示链路，商品当前发布链路为：{reviewFlow.join('、')}。</p>
        <ol className="publish-rules-legal-list">
          {ruleHighlights.map((item) => (
            <li key={item}>{item}。</li>
          ))}
          <li>服务发布链路为：{serviceReviewFlow.join('、')}。</li>
          {serviceRuleHighlights.map((item) => (
            <li key={item}>{item}。</li>
          ))}
          <li>内容展示后，平台仍可基于举报、抽检或风险复核再次核查。存在违规情形的，平台有权采取下架、限制发布或其他必要处置措施。</li>
        </ol>
      </section>

      <section className="publish-rules-document-section">
        <h4>第九条 发布人承诺</h4>
        <ol className="publish-rules-legal-list">
          <li>发布人承诺其发布内容真实、完整、可核验，并对所发布商品享有合法处分权。</li>
          <li>发布人承诺遵守校园管理要求和平台治理规则，不发布影响校园安全秩序或损害他人权益的内容。</li>
          <li>发布服务时，发布人承诺其具备相应履约能力、时间安排与必要授权，不以发布为名实施引流、骚扰、欺诈、套现或其他不当行为。</li>
          <li>发布人知悉并接受：因虚假描述、违规发布、失约纠纷或交易争议引发的后续核查，平台有权保留相关记录并据此实施风险控制。</li>
        </ol>
      </section>
    </article>
  );
}
