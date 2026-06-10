import { PRODUCT_CATEGORY_NAMES } from '../../constants/productCategories';
import type { PublishingRules } from '../../services/api';

export const defaultAllowedCategories = [...PRODUCT_CATEGORY_NAMES];
export const defaultDormElectricalWhitelist = ['电脑', '非充电台灯', '手机', '平板电脑', '20000mAh以下充电宝', '电动牙刷', '电动剃须刀', '相机'];
export const defaultCommunityNotices = [
  '宿舍电器只允许白名单内物品发布，吹风机、电热饭盒、热水壶等会被系统直接驳回。',
  '交易优先选择图书馆、食堂、公寓楼下等校内公共区域，建议当面验货后再确认。',
  '商品标题和描述请写清成色、配件、容量或版本，避免同学误判。'
];
export const defaultRuleHighlights = [
  '禁售词命中直接驳回',
  '白名单外宿舍电器禁止发布',
  '充电宝需标明容量且不超过 20000mAh',
  '通过后仍保留人工巡检'
];
export const defaultTrustSignals = ['实名认证', '校内面交', '交易留痕'];
export const defaultProhibitedKeywords = ['刀具', '代抢', '账号'];
export const defaultReviewFlow = ['实名认证', '内容校验', '人工审核'];

export type PublishRulesDocumentProps = {
  allowedCategories: string[];
  communityNotices: string[];
  dormElectricalWhitelist: string[];
  prohibitedKeywords: string[];
  reviewFlow: string[];
  ruleHighlights: string[];
  trustSignals: string[];
};

export function resolvePublishingRulesDocumentProps(rules: PublishingRules | null): PublishRulesDocumentProps {
  return {
    allowedCategories: rules?.allowedCategories ?? defaultAllowedCategories,
    dormElectricalWhitelist: rules?.dormElectricalWhitelist ?? defaultDormElectricalWhitelist,
    communityNotices: rules?.communityNotices ?? defaultCommunityNotices,
    ruleHighlights: rules?.ruleHighlights ?? defaultRuleHighlights,
    prohibitedKeywords: rules?.prohibitedKeywords ?? defaultProhibitedKeywords,
    reviewFlow: rules?.reviewFlow ?? defaultReviewFlow,
    trustSignals: rules?.trustSignals ?? defaultTrustSignals
  };
}

export function PublishRulesDocument({
  allowedCategories,
  communityNotices,
  dormElectricalWhitelist,
  prohibitedKeywords,
  reviewFlow,
  ruleHighlights,
  trustSignals
}: PublishRulesDocumentProps) {
  return (
    <article className="publish-rules-document" aria-label="商品发布规则">
      <header className="publish-rules-document-header">
        <h3>商品发布规则</h3>
        <p>
          为维护校内交易秩序，保障发布信息真实、清晰、可核验，用户在本平台提交商品发布申请前，应当完整阅读并遵守以下规则。用户提交发布申请的，视为已知悉并同意接受本规则约束。
        </p>
      </header>

      <section className="publish-rules-document-section">
        <h4>第一条 适用范围</h4>
        <p>
          本规则适用于用户通过 SwapCampus 平台发布的全部闲置商品信息，包括标题、分类、价格、成色、描述、标签及其他补充说明。平台有权依据本规则对发布内容进行校验、审核、留痕、驳回、下架及后续复核处理。
        </p>
      </section>

      <section className="publish-rules-document-section">
        <h4>第二条 发布信息真实性要求</h4>
        <ol className="publish-rules-legal-list">
          <li>发布人应当如实填写商品标题、价格、成色、功能状态、配件明细、容量或版本信息，不得隐瞒影响交易判断的重要事实。</li>
          <li>商品描述应当与实物保持一致，不得使用夸大、误导、模糊或明显不完整的表述，不得冒用他人图片或虚构商品状态。</li>
          <li>默认交易方式为校内面交。发布人应在描述中写明可交易地点、交付条件及必要注意事项，确保信息能够被其他同学直接理解和核验。</li>
        </ol>
      </section>

      <section className="publish-rules-document-section">
        <h4>第三条 允许发布类目</h4>
        <p>当前允许发布的商品分类如下：</p>
        <p className="publish-rules-inline-list">{allowedCategories.join('、')}。</p>
        <p>
          发布人应当按照商品实际属性选择分类。平台发现分类明显错误、故意规避审核或借用其他分类发布受限物品的，有权要求修改、直接驳回或下架处理。
        </p>
      </section>

      <section className="publish-rules-document-section">
        <h4>第四条 宿舍电器发布限制</h4>
        <p>宿舍电器仅限以下白名单物品可以发布：</p>
        <p className="publish-rules-inline-list">{dormElectricalWhitelist.join('、')}。</p>
        <p>
          白名单范围以外的宿舍电器不得发布。对于吹风机、电热饭盒、热水壶等违反校园用电管理要求或存在明显安全风险的物品，平台将直接驳回，不进入正常发布流程。
        </p>
      </section>

      <section className="publish-rules-document-section">
        <h4>第五条 禁止发布内容</h4>
        <ol className="publish-rules-legal-list">
          <li>禁止发布命中平台禁售词、涉嫌规避监管、违规代办、账号交易或其他高风险内容的商品信息。</li>
          <li>当前重点识别的禁售或高风险关键词示例如下：{prohibitedKeywords.join('、')}。</li>
          <li>禁止通过拆分表述、谐音替代、图片暗示或标签误导等方式规避平台审核。平台一经识别，有权直接驳回并记录风险行为。</li>
        </ol>
      </section>

      <section className="publish-rules-document-section">
        <h4>第六条 交易与安全要求</h4>
        <ol className="publish-rules-legal-list">
          {communityNotices.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li>平台鼓励用户保留必要的交易沟通记录、验货记录和交付记录。当前交易保障机制包括：{trustSignals.join('、')}。</li>
        </ol>
      </section>

      <section className="publish-rules-document-section">
        <h4>第七条 审核机制与处置方式</h4>
        <p>商品发布默认进入校内审核流程，当前审核步骤为：{reviewFlow.join('、')}。</p>
        <ol className="publish-rules-legal-list">
          {ruleHighlights.map((item) => (
            <li key={item}>{item}。</li>
          ))}
          <li>审核通过后，平台仍可基于举报、抽检或风险复核再次核查。存在违规情形的，平台有权采取驳回、下架、限制发布或其他必要处置措施。</li>
        </ol>
      </section>

      <section className="publish-rules-document-section">
        <h4>第八条 发布人承诺</h4>
        <ol className="publish-rules-legal-list">
          <li>发布人承诺其发布内容真实、完整、可核验，并对所发布商品享有合法处分权。</li>
          <li>发布人承诺遵守校园管理要求和平台治理规则，不发布影响校园安全秩序或损害他人权益的内容。</li>
          <li>发布人知悉并接受：因虚假描述、违规发布、规避审核或交易纠纷引发的后续核查，平台有权保留相关记录并据此实施风险控制。</li>
        </ol>
      </section>
    </article>
  );
}
